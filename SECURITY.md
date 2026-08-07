# Security

Report vulnerabilities privately through GitHub Security Advisories for
`forgemeshlabs/kronos-forgemesh-mcp`.

Never include wallet private keys, payment signatures, or other credentials in
an issue. Use a dedicated low-balance Base wallet for MCP payments. The package
does not log the configured wallet key and restricts production API calls to
`https://kronos.forgemesh.io`.
