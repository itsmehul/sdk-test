output "asg_name" {
  value = aws_autoscaling_group.gpu.name
}

output "asg_arn" {
  value = aws_autoscaling_group.gpu.arn
}

output "models_bucket" {
  value = aws_s3_bucket.models.bucket
}
