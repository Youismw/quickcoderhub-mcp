# QuickCoderHub MCP & CLI

123 deterministic engineering tools for AI agents and terminal workflows—covering 3D STL CAD, G-code, UF2/Intel HEX firmware, ELF/PE/Mach-O/WASM disassembly, Verilog/VCD, PDF repair/redaction/forms, Docker/Kubernetes/systemd/seccomp, X.509/SAML/JWT/SBOM security, networking, and API/data tooling.

This repository contains the lightweight open-source CLI and stdio MCP proxy (`quickcoderhub` on npm) that connects to the stateless remote MCP server at `https://api.quickcoderhub.com`. For 100% on-device browser execution, use [quickcoderhub.com](https://quickcoderhub.com).

## Quick Start

### Remote MCP (Recommended — Zero Install)

**Claude Code:**
```bash
# Flagship 20 high-moat engineering tools
claude mcp add --transport http quickcoderhub https://api.quickcoderhub.com/mcp

# Or add only the category you need (keeps agent context small):
claude mcp add --transport http qch-pdf https://api.quickcoderhub.com/mcp/pdf-suite
claude mcp add --transport http qch-devops https://api.quickcoderhub.com/mcp/devops-linux
claude mcp add --transport http qch-security https://api.quickcoderhub.com/mcp/security-crypto
```

**Claude Desktop / Cursor / VS Code (`mcpServers`):**
```json
{
  "mcpServers": {
    "quickcoderhub": {
      "command": "npx",
      "args": ["-y", "quickcoderhub", "mcp"]
    }
  }
}
```
To scope the stdio proxy to a single category, pass `"--category", "pdf-suite"` (or any category slug below) after `"mcp"`.

### Terminal CLI
```bash
# List tools
npx -y quickcoderhub list
npx -y quickcoderhub list --category 3d-cad

# Run tools directly
npx -y quickcoderhub stl-heal broken.stl --out fixed.stl
npx -y quickcoderhub pdf-repair corrupt.pdf --out repaired.pdf
npx -y quickcoderhub binary-triage firmware.bin --json
npx -y quickcoderhub jwt-decoder token.jwt --json
```

---

## Available MCP Endpoints (123 Tools Across 8 Categories)

| Endpoint | Registry ID | Tools | Scope |
| :--- | :--- | :---: | :--- |
| `https://api.quickcoderhub.com/mcp` | `com.quickcoderhub/tools` | 20 | Flagship high-moat engineering tools |
| `https://api.quickcoderhub.com/mcp/3d-cad` | `com.quickcoderhub/3d-cad` | 6 | `stl_heal`, `cad_convert_to_stl`, `stl_slice_to_gcode`, `gcode_estimate_and_inject`, `svg_optimize`, `svg_path_inspect` |
| `https://api.quickcoderhub.com/mcp/embedded-eda` | `com.quickcoderhub/embedded-eda` | 8 | `firmware_merge_and_uf2`, `elf_crash_backtrace_decode`, `karnaugh_minimize_and_verilog`, `logic_trace_decode_wavedrom`, `intel_hex_inspect`, `can_bus_decode`, `cmake_generate`, `ieee754_inspect` |
| `https://api.quickcoderhub.com/mcp/binary-forensics` | `com.quickcoderhub/binary-forensics` | 12 | `binary_triage`, `executable_inspect`, `disassemble_wasm_or_hex`, `wasm_inspect`, `hexdump_inspect`, `archive_join_and_verify`, `archive_peek_central_dir`, `pcap_inspect`, `exif_inspect_and_strip`, `sqlite_header_inspect`, `sourcemap_analyze`, `unicode_inspect` |
| `https://api.quickcoderhub.com/mcp/pdf-suite` | `com.quickcoderhub/pdf-suite` | 20 | `pdf_repair`, `pdf_compliance_audit`, `pdf_merge`, `pdf_split`, `pdf_remove_pages`, `pdf_extract_pages`, `pdf_rotate`, `pdf_add_page_numbers`, `pdf_add_watermark`, `pdf_crop_margins`, `pdf_protect_metadata`, `pdf_unlock_strip_restrictions`, `pdf_redact_terms`, `pdf_forms_inspect_and_fill`, `pdf_to_markdown`, `pdf_to_pdfa_archival`, `pdf_compare`, `pdf_compress`, `pdf_from_images`, `pdf_from_html_text` |
| `https://api.quickcoderhub.com/mcp/devops-linux` | `com.quickcoderhub/devops-linux` | 20 | `docker_to_systemd`, `systemd_security_audit`, `seccomp_apparmor_generate`, `server_log_analyze`, `docker_run_to_compose`, `dockerfile_lint`, `docker_image_manifest_inspect`, `k8s_manifest_audit`, `k8s_resource_estimate`, `terraform_plan_inspect`, `hcl_format_and_validate`, `nginx_config_audit`, `apache_config_audit`, `github_actions_audit`, `github_actions_expression_eval`, `gitlab_ci_audit`, `dotenv_audit_and_example`, `cron_explain_and_schedule`, `gitignore_generate`, `bash_script_lint` |
| `https://api.quickcoderhub.com/mcp/security-crypto` | `com.quickcoderhub/security-crypto` | 20 | `x509_certificate_inspect`, `saml_assertion_decode`, `jwt_decode_and_audit`, `pgp_packet_inspect`, `crypto_keypair_generate`, `ssh_config_generate_and_audit`, `ssh_known_hosts_inspect`, `csp_parse_and_audit`, `cors_preflight_simulate`, `permissions_policy_audit`, `referrer_policy_audit`, `ioc_defang_and_refang`, `sbom_inspect_and_audit`, `spdx_license_compatibility`, `package_json_audit`, `lockfile_integrity_audit`, `password_kdf_hash_and_verify`, `aes_gcm_encrypt_decrypt`, `hmac_sign_and_verify`, `bip39_entropy_mnemonic` |
| `https://api.quickcoderhub.com/mcp/net-web-media` | `com.quickcoderhub/net-web-media` | 18 | `ipv4_subnet_calculate`, `ipv4_representation_convert`, `ipv4_cidr_range_expand`, `ipv6_cidr_calculate`, `mac_oui_inspect`, `webrtc_sdp_inspect`, `websocket_frame_decode`, `har_performance_analyze`, `http_headers_security_audit`, `cache_control_parse_and_build`, `robots_txt_evaluate`, `sitemap_xml_validate`, `rss_atom_feed_validate`, `json_ld_schema_validate`, `html_accessibility_audit`, `subtitle_convert_srt_vtt`, `subtitle_time_shift_and_fix`, `media_container_inspect` |
| `https://api.quickcoderhub.com/mcp/data-api-code` | `com.quickcoderhub/data-api-code` | 19 | `openapi_spec_inspect`, `openapi_mock_generate`, `graphql_schema_inspect`, `graphql_query_build_and_validate`, `curl_to_code_convert`, `sql_format_and_lint`, `sql_ddl_to_mermaid_er`, `json_to_typescript_and_zod`, `json_schema_validate_and_mock`, `jsonpath_query_eval`, `json_structural_diff`, `json_to_csv_convert`, `csv_profile_and_query`, `ndjson_stream_analyze`, `yaml_json_convert`, `xml_format_and_to_json`, `js_code_complexity_analyze`, `semver_range_evaluate`, `junit_tap_test_report_parse` |
| `https://api.quickcoderhub.com/mcp/all` | — | 123 | Unified endpoint exposing all 123 tools |

---

## Privacy & Limits
- Files sent to `api.quickcoderhub.com` are processed ephemerally in memory and never stored.
- Supports direct `POST /v1/<tool-slug>` REST calls and `x402` USDC micropayments on Base (`eip155:8453`).
- Discovery manifest: `https://quickcoderhub.com/.well-known/mcp.json`
