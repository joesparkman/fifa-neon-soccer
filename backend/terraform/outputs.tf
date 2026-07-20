output "api_url" {
  description = "Paste this into app.js as API_BASE"
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "asset_base_url" {
  description = "CloudFront base URL for optional asset hosting"
  value       = "https://${aws_cloudfront_distribution.assets.domain_name}"
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.spa.id
}

output "cognito_hosted_ui_domain" {
  value = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}
