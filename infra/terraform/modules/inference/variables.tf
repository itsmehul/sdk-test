variable "name" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "security_group_id" {
  type = string
}

variable "backend" {
  description = "`gpu` runs vLLM on NVIDIA instances; `cpu` runs Ollama on Graviton (arm64) instances."
  type        = string

  validation {
    condition     = contains(["gpu", "cpu"], var.backend)
    error_message = "backend must be \"gpu\" or \"cpu\"."
  }
}

variable "instance_types" {
  description = "Cheapest first; extra types widen spot capacity."
  type        = list(string)
}

variable "use_spot" {
  type = bool
}

variable "root_volume_gb" {
  type = number
}

variable "vllm_version" {
  type = string
}

variable "chat_model" {
  description = "Hugging Face repo id (gpu) or Ollama tag (cpu); also the served model name."
  type        = string
}

variable "chat_port" {
  type = number
}

variable "chat_max_model_len" {
  type = number
}

variable "embed_model" {
  type = string
}

variable "embed_port" {
  type = number
}

variable "idle_minutes" {
  type = number
}

variable "inference_api_key_parameter_name" {
  type = string
}

variable "inference_api_key_parameter_arn" {
  type = string
}
