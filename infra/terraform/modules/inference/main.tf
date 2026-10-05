data "aws_region" "current" {}

# AWS Deep Learning Base AMI: NVIDIA driver, CUDA and AWS CLI preinstalled.
data "aws_ssm_parameter" "ami" {
  name = "/aws/service/deeplearning/ami/x86_64/base-oss-nvidia-driver-gpu-ubuntu-22.04/latest/ami-id"
}

resource "aws_s3_bucket" "models" {
  bucket_prefix = "${var.name}-models-"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "models" {
  bucket                  = aws_s3_bucket.models.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_iam_role" "gpu" {
  name_prefix = "${var.name}-gpu-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.gpu.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "gpu" {
  role = aws_iam_role.gpu.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.models.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "${aws_s3_bucket.models.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = var.inference_api_key_parameter_arn
      },
      {
        Effect   = "Allow"
        Action   = ["autoscaling:TerminateInstanceInAutoScalingGroup"]
        Resource = aws_autoscaling_group.gpu.arn
      },
    ]
  })
}

resource "aws_iam_instance_profile" "gpu" {
  name_prefix = "${var.name}-gpu-"
  role        = aws_iam_role.gpu.name
}

resource "aws_launch_template" "gpu" {
  name_prefix            = "${var.name}-gpu-"
  image_id               = data.aws_ssm_parameter.ami.value
  vpc_security_group_ids = [var.security_group_id]
  update_default_version = true

  iam_instance_profile {
    arn = aws_iam_instance_profile.gpu.arn
  }

  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  block_device_mappings {
    device_name = "/dev/sda1"
    ebs {
      volume_size           = var.root_volume_gb
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }
  }

  user_data = base64encode(templatefile("${path.module}/user-data.sh.tftpl", {
    region                      = data.aws_region.current.region
    asg_name                    = "${var.name}-gpu"
    bucket                      = aws_s3_bucket.models.bucket
    inference_api_key_parameter = var.inference_api_key_parameter_name
    vllm_version                = var.vllm_version
    chat_model                  = var.chat_model
    chat_port                   = var.chat_port
    chat_max_model_len          = var.chat_max_model_len
    embed_model                 = var.embed_model
    embed_port                  = var.embed_port
    idle_minutes                = var.idle_minutes
  }))

  tag_specifications {
    resource_type = "instance"
    tags          = { Name = "${var.name}-gpu" }
  }
}

resource "aws_autoscaling_group" "gpu" {
  name                = "${var.name}-gpu"
  min_size            = 0
  max_size            = 1
  desired_capacity    = 0
  vpc_zone_identifier = var.subnet_ids
  health_check_type   = "EC2"

  mixed_instances_policy {
    instances_distribution {
      on_demand_base_capacity                  = 0
      on_demand_percentage_above_base_capacity = var.use_spot ? 0 : 100
      spot_allocation_strategy                 = "price-capacity-optimized"
    }

    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.gpu.id
        version            = "$Latest"
      }

      dynamic "override" {
        for_each = var.instance_types
        content {
          instance_type = override.value
        }
      }
    }
  }

  # The API Lambda raises capacity on demand and idle instances terminate themselves.
  lifecycle {
    ignore_changes = [desired_capacity]
  }
}
