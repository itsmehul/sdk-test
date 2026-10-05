terraform {
  required_version = ">= 1.10"

  # Partial config: bucket, key and region come from backend.hcl (see backend.hcl.example).
  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { Project = var.name, Environment = "prod", ManagedBy = "terraform" }
  }
}
