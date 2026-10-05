data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)
  cpu = var.inference_backend == "cpu"

  # Ollama serves chat and embeddings from one port; vLLM runs one server per model.
  chat_port      = local.cpu ? 11434 : 8000
  embed_port     = local.cpu ? 11434 : 8001
  chat_model     = local.cpu ? var.ollama_chat_model : var.chat_model
  embed_model    = local.cpu ? var.ollama_embed_model : var.embed_model
  health_path    = local.cpu ? "/" : "/health"
  instance_types = local.cpu ? var.cpu_instance_types : var.gpu_instance_types
  root_volume_gb = local.cpu ? 30 : 100
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
  backend            = var.inference_backend
  instance_types     = local.instance_types
  root_volume_gb     = local.root_volume_gb
  use_spot           = var.use_spot
  vllm_version       = var.vllm_version
  chat_model         = local.chat_model
  chat_port          = local.chat_port
  chat_max_model_len = var.chat_max_model_len
  embed_model        = local.embed_model
  embed_port         = local.embed_port
  idle_minutes       = var.idle_minutes

  inference_api_key_parameter_name = aws_ssm_parameter.inference_api_key.name
  inference_api_key_parameter_arn  = aws_ssm_parameter.inference_api_key.arn
}

module "api" {
  source = "../../modules/api"

  name                  = var.name
  bundle_dir            = "${path.root}/../../../../apps/api/dist/lambda"
  subnet_ids            = module.network.private_subnet_ids
  security_group_id     = module.network.api_security_group_id
  gpu_asg_name          = module.inference.asg_name
  gpu_asg_arn           = module.inference.asg_arn
  chat_model            = local.chat_model
  chat_port             = local.chat_port
  embed_model           = local.embed_model
  embed_port            = local.embed_port
  inference_health_path = local.health_path

  api_key_parameter_name           = aws_ssm_parameter.api_key.name
  inference_api_key_parameter_name = aws_ssm_parameter.inference_api_key.name
  secret_parameter_arns            = [aws_ssm_parameter.api_key.arn, aws_ssm_parameter.inference_api_key.arn]
}
