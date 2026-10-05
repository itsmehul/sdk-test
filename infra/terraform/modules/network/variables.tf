variable "name" {
  type = string
}

variable "azs" {
  type = list(string)
}

variable "cidr_block" {
  type    = string
  default = "10.20.0.0/16"
}

variable "nat_instance_type" {
  type    = string
  default = "t4g.nano"
}

variable "gpu_ports" {
  type = list(number)
}
