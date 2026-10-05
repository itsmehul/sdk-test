variable "name" {
  type = string
}

variable "bundle_dir" {
  description = "Output of `pnpm --filter @rightpeople/api bundle`."
  type        = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "api_key_parameter_name" {
  type = string
}

variable "inference_api_key_parameter_name" {
  type = string
}

variable "secret_parameter_arns" {
  type = list(string)
}

variable "gpu_asg_name" {
  type = string
}

variable "gpu_asg_arn" {
  type = string
}

variable "chat_model" {
  type = string
}

variable "chat_port" {
  type = number
}

variable "embed_model" {
  type = string
}

variable "embed_port" {
  type = number
}

variable "inference_health_path" {
  type = string
}
