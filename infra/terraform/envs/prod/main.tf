data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs        = slice(data.aws_availability_zones.available.names, 0, var.az_count)
  chat_port  = 8000
  embed_port = 8001
}

resource "random_password" "api_key" {
  length  = 40
  special = false
}

resource "random_password" "inference_api_key" {
  length  = 40
  special = false
}

resource "aws_ssm_parameter" "api_key" {
  name  = "/${var.name}/prod/api-key"
  type  = "SecureString"
  value = "sk-ifz-${random_password.api_key.result}"
}

resource "aws_ssm_parameter" "inference_api_key" {
  name  = "/${var.name}/prod/inference-api-key"
  type  = "SecureString"
  value = random_password.inference_api_key.result
}

module "network" {
  source    = "../../modules/network"
  name      = var.name
  azs       = local.azs
  gpu_ports = [local.chat_port, local.embed_port]
}

module "inference" {
  source = "../../modules/inference"

  name               = var.name
  subnet_ids         = module.network.public_subnet_ids
  security_group_id  = module.network.gpu_security_group_id
  instance_types     = var.gpu_instance_types
  use_spot           = var.use_spot
  vllm_version       = var.vllm_version
  chat_model         = var.chat_model
  chat_port          = local.chat_port
  chat_max_model_len = var.chat_max_model_len
  embed_model        = var.embed_model
  embed_port         = local.embed_port
  idle_minutes       = var.idle_minutes

  inference_api_key_parameter_name = aws_ssm_parameter.inference_api_key.name
  inference_api_key_parameter_arn  = aws_ssm_parameter.inference_api_key.arn
}

module "api" {
  source = "../../modules/api"

  name              = var.name
  bundle_dir        = "${path.root}/../../../../apps/api/dist/lambda"
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.api_security_group_id
  gpu_asg_name      = module.inference.asg_name
  gpu_asg_arn       = module.inference.asg_arn
  chat_model        = var.chat_model
  chat_port         = local.chat_port
  embed_model       = var.embed_model
  embed_port        = local.embed_port

  api_key_parameter_name           = aws_ssm_parameter.api_key.name
  inference_api_key_parameter_name = aws_ssm_parameter.inference_api_key.name
  secret_parameter_arns            = [aws_ssm_parameter.api_key.arn, aws_ssm_parameter.inference_api_key.arn]
}
