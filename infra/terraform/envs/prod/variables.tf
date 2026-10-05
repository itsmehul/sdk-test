variable "name" {
  type    = string
  default = "rightpeople"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "az_count" {
  description = "More zones widen the pool of spot GPU capacity."
  type        = number
  default     = 2
}

variable "inference_backend" {
  description = "`gpu` serves vLLM on NVIDIA spot instances (needs G-family vCPU quota); `cpu` serves Ollama on Graviton."
  type        = string
  default     = "cpu"
}

variable "cpu_instance_types" {
  description = "4 vCPU / 8 GB Graviton instances; extra types widen spot capacity."
  type        = list(string)
  default     = ["c7g.xlarge", "c6g.xlarge", "m7g.xlarge"]
}

variable "ollama_chat_model" {
  type    = string
  default = "qwen2.5:1.5b"
}

variable "ollama_embed_model" {
  type    = string
  default = "nomic-embed-text:v1.5"
}

variable "gpu_instance_types" {
  description = "g4dn.xlarge (T4 16 GB) is the cheapest NVIDIA instance; g6.xlarge (L4) is the fallback."
  type        = list(string)
  default     = ["g4dn.xlarge"]
}

variable "use_spot" {
  type    = bool
  default = true
}

variable "vllm_version" {
  type    = string
  default = "0.10.2"
}

variable "chat_model" {
  type    = string
  default = "Qwen/Qwen2.5-1.5B-Instruct"
}

variable "chat_max_model_len" {
  type    = number
  default = 4096
}

variable "embed_model" {
  type    = string
  default = "nomic-ai/nomic-embed-text-v1.5"
}

variable "idle_minutes" {
  description = "Minutes without requests before the inference instance terminates itself."
  type        = number
  default     = 15
}
