# EV Trainer AWS Infrastructure
# Terraform configuration for EC2 and RDS deployment

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state backend for team collaboration (uncomment after initial setup)
  # backend "s3" {
  #   bucket         = "ev-trainer-terraform-state"
  #   key            = "terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "ev-trainer-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ev-trainer"
      Environment = "production"
      ManagedBy   = "terraform"
    }
  }
}

# ------------------------------------------------------------------------------
# DATA SOURCES
# ------------------------------------------------------------------------------

# Get latest Ubuntu 22.04 LTS AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Get available AZs
data "aws_availability_zones" "available" {
  state = "available"
}

# ------------------------------------------------------------------------------
# VPC AND NETWORKING
# ------------------------------------------------------------------------------

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "ev-trainer-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "ev-trainer-igw"
  }
}

# Public Subnet (for EC2)
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "ev-trainer-public-subnet"
  }
}

# Private Subnets (for RDS - requires 2 AZs)
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]

  tags = {
    Name = "ev-trainer-private-subnet-a"
  }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]

  tags = {
    Name = "ev-trainer-private-subnet-b"
  }
}

# Route Table for Public Subnet
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "ev-trainer-public-rt"
  }
}

# Associate Public Subnet with Route Table
resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ------------------------------------------------------------------------------
# SECURITY GROUPS
# ------------------------------------------------------------------------------

# EC2 Security Group
resource "aws_security_group" "ec2" {
  name        = "ev-trainer-ec2-sg"
  description = "Security group for EV Trainer EC2 instance"
  vpc_id      = aws_vpc.main.id

  # SSH access
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  # HTTP access
  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS access
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Application port (for direct API access during development)
  ingress {
    description = "Application"
    from_port   = 4000
    to_port     = 4000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound - allow all
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "ev-trainer-ec2-sg"
  }
}

# RDS Security Group
resource "aws_security_group" "rds" {
  name        = "ev-trainer-rds-sg"
  description = "Security group for EV Trainer RDS instance"
  vpc_id      = aws_vpc.main.id

  # PostgreSQL access from EC2 only
  ingress {
    description     = "PostgreSQL from EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  tags = {
    Name = "ev-trainer-rds-sg"
  }
}

# ------------------------------------------------------------------------------
# RDS POSTGRESQL
# ------------------------------------------------------------------------------

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "ev-trainer-db-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  tags = {
    Name = "ev-trainer-db-subnet-group"
  }
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "postgres" {
  identifier = "ev-trainer-db"

  # Engine
  engine               = "postgres"
  engine_version       = "15.12"
  instance_class       = var.db_instance_class
  parameter_group_name = "default.postgres15"

  # Storage
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  # Database
  db_name  = "ev_trainer"
  username = var.db_username
  password = var.db_password

  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  # Backup
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  # Performance Insights (free tier available)
  performance_insights_enabled = true

  # Deletion protection (disable for dev/staging)
  deletion_protection = false
  skip_final_snapshot = true

  tags = {
    Name = "ev-trainer-db"
  }
}

# ------------------------------------------------------------------------------
# IAM ROLE FOR EC2
# ------------------------------------------------------------------------------

# IAM Role for EC2
resource "aws_iam_role" "ec2" {
  name = "ev-trainer-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "ev-trainer-ec2-role"
  }
}

# CloudWatch Logs Policy
resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "ev-trainer-cloudwatch-logs"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = "*"
      }
    ]
  })
}

# SSM Session Manager Policy (SSH alternative)
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Instance Profile
resource "aws_iam_instance_profile" "ec2" {
  name = "ev-trainer-ec2-profile"
  role = aws_iam_role.ec2.name
}

# ------------------------------------------------------------------------------
# EC2 INSTANCE
# ------------------------------------------------------------------------------

# EC2 Instance
resource "aws_instance" "app" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.ssh_key_name
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = <<-EOF
              #!/bin/bash
              set -e

              # Update system
              apt-get update
              apt-get upgrade -y

              # Install Node.js 20.x
              curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
              apt-get install -y nodejs

              # Install PM2 globally
              npm install -g pm2

              # Install Git
              apt-get install -y git

              # Install PostgreSQL client tools
              apt-get install -y postgresql-client

              # Install nginx for reverse proxy (Phase 3)
              apt-get install -y nginx

              # Create app directory
              mkdir -p /home/ubuntu/ev-trainer
              chown ubuntu:ubuntu /home/ubuntu/ev-trainer

              # Create logs directory
              mkdir -p /home/ubuntu/ev-trainer/logs
              chown ubuntu:ubuntu /home/ubuntu/ev-trainer/logs

              # Setup PM2 startup script
              sudo -u ubuntu pm2 startup systemd -u ubuntu --hp /home/ubuntu
              EOF

  tags = {
    Name = "ev-trainer-app"
  }
}

# Elastic IP
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "ev-trainer-eip"
  }
}
