# EV Trainer Terraform Variables

variable "aws_region" {
  description = "AWS region for infrastructure deployment"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type for application server"
  type        = string
  default     = "t3.micro"
}

variable "db_instance_class" {
  description = "RDS instance class for PostgreSQL database"
  type        = string
  default     = "db.t3.micro"
}

variable "db_username" {
  description = "Master username for RDS PostgreSQL"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "Master password for RDS PostgreSQL"
  type        = string
  sensitive   = true
  # No default - must be provided via TF_VAR_db_password or -var
}

variable "ssh_key_name" {
  description = "Name of the SSH key pair in AWS for EC2 access"
  type        = string
  # No default - must be provided
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed for SSH access (recommend tightening for production)"
  type        = string
  default     = "0.0.0.0/0"
}
