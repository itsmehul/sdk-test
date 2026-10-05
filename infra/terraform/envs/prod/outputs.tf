output "api_base_url" {
  description = "Set as INTERFAZE_BASE_URL for the SDKs."
  value       = "${trimsuffix(module.api.function_url, "/")}/v1"
}

output "api_key" {
  description = "Read with `terraform output -raw api_key`."
  value       = aws_ssm_parameter.api_key.value
  sensitive   = true
}

output "gpu_asg_name" {
  value = module.inference.asg_name
}

output "models_bucket" {
  value = module.inference.models_bucket
}
