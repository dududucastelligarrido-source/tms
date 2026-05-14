# Melhorias para Versões Futuras

## v2 — Módulos de Negócio

### Financeiro & Administrativo
- Contas a pagar por O.S., veículo ou funcionário
- Contas a receber por viagem/cliente
- Controle de débitos e multas de trânsito
- Repositório seguro de documentos (CRLV, contratos) com expiração
- Relatório de DRE por período

### Manutenção & Frota
- Plano de manutenção preventiva com cronograma e alertas de vencimento por KM
- Controle de troca de óleo (por data e KM rodado)
- Gestão de pneus: histórico de inserção, controle de vida útil e vencimento por eixo
- Ordens de serviço vinculadas a veículo

### Insumos & Alertas
- Controle de abastecimento com cálculo de consumo médio por motorista/veículo
- Detecção automática de anomalias de consumo (possível fraude)
- Alerta automático de vencimento: CNH de motoristas, CRLV de veículos
- Notificações push para alertas críticos

### Inteligência & Segurança
- Dashboard analítico com gráficos (Recharts): KMs por período, custo por rota, eficiência por motorista
- Relatórios exportáveis (PDF/Excel)
- Controle de permissões granular por recurso (não apenas por role)
- Gerenciamento de risco operacional com protocolos de segurança
- Log de auditoria de ações administrativas

---

## v2 — Melhorias Técnicas

### PWA Offline
- Suporte offline para registro de eventos de viagem (checklist, custos, km)
- Sincronização automática quando o sinal voltar
- Fila de operações offline com IndexedDB + Workbox BackgroundSync
- Tratamento de conflitos de sync (last-write-wins ou resolução manual)

### App Nativo (React Native)
- Migrar a interface do motorista para React Native (Expo)
- GPS em background para rastreamento de rota
- Câmera nativa para fotos de hodômetro/recibos sem abrir browser
- Notificações push nativas

### Upload de Arquivos
- Upload de fotos de hodômetro para R2 (Cloudflare)
- Upload de recibos de custos com preview
- Compressão de imagem no cliente antes do upload
- Implementar endpoint POST /uploads com presigned URL

### Autenticação
- Magic link por e-mail (sem senha para motoristas)
- SSO com Google/Microsoft para transportadoras enterprise
- 2FA para admin

### Multi-tenant Avançado
- Plano de limites (limite de motoristas, veículos, viagens por plano)
- Onboarding automatizado via wizard de cadastro
- Billing integration (Stripe)
- Painel super_admin cross-tenant

### Performance
- Paginação em todas as listagens (cursor-based)
- Cache Redis para queries frequentes (ativos por tenant)
- Rate limiting por tenant
- Webhooks para integração com ERPs

### Qualidade
- E2E tests com Playwright
- TypeScript strict mode no frontend (remover os cast `as any`)
- Geração automática de cliente HTTP a partir do schema OpenAPI
- Monitoring com OpenTelemetry
