variable "aws_region" {
  default = "us-east-1"
}

variable "allowed_origins" {
  default = "http://localhost:5500,https://app.joesparkman.com"
}

variable "callback_urls" {
  type    = list(string)
  default = ["http://localhost:5500", "https://app.joesparkman.com"]
}
