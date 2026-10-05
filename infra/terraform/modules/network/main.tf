resource "aws_vpc" "this" {
  cidr_block           = var.cidr_block
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = var.name }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = var.name }
}

# GPU instances live in public subnets so they pull Python wheels and model weights at full speed
# without a NAT. Their security group only admits the Lambda.
resource "aws_subnet" "public" {
  count                   = length(var.azs)
  vpc_id                  = aws_vpc.this.id
  availability_zone       = var.azs[count.index]
  cidr_block              = cidrsubnet(var.cidr_block, 8, count.index)
  map_public_ip_on_launch = true
  tags                    = { Name = "${var.name}-public-${var.azs[count.index]}" }
}

resource "aws_subnet" "private" {
  count             = length(var.azs)
  vpc_id            = aws_vpc.this.id
  availability_zone = var.azs[count.index]
  cidr_block        = cidrsubnet(var.cidr_block, 8, 10 + count.index)
  tags              = { Name = "${var.name}-private-${var.azs[count.index]}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name}-public" }

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name}-private" }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# A t4g.nano NAT instance gives the Lambda outbound access to AWS APIs for a few dollars a month,
# instead of a managed NAT gateway or one interface endpoint per service.
module "nat" {
  source  = "RaJiska/fck-nat/aws"
  version = "~> 1.3"

  name                = "${var.name}-nat"
  vpc_id              = aws_vpc.this.id
  subnet_id           = aws_subnet.public[0].id
  instance_type       = var.nat_instance_type
  ha_mode             = true
  update_route_tables = true
  route_tables_ids    = { private = aws_route_table.private.id }
}

resource "aws_security_group" "api" {
  name        = "${var.name}-api"
  description = "Interfaze API Lambda"
  vpc_id      = aws_vpc.this.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "gpu" {
  name        = "${var.name}-gpu"
  description = "vLLM GPU instances, reachable only from the API Lambda"
  vpc_id      = aws_vpc.this.id

  dynamic "ingress" {
    for_each = toset(var.gpu_ports)
    content {
      description     = "vLLM from API"
      from_port       = ingress.value
      to_port         = ingress.value
      protocol        = "tcp"
      security_groups = [aws_security_group.api.id]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
