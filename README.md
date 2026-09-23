# StockFlow

Plataforma SaaS de gestão de estoque para pequenas e médias empresas, construída com Next.js, TypeScript e Supabase.

## O que já está pronto

- Autenticação com Supabase Auth
- Multiempresa com isolamento por `company_id`
- Dashboard operacional em tempo real
- Produtos com SKU, código de barras, marca, lote, validade, preços e estoque mínimo/máximo
- Categorias, fornecedores e clientes
- Compras e vendas
- Cancelamento de operações com reversão de estoque
- Entradas, saídas e histórico de movimentações
- Inventário e ajustes de estoque com rastreabilidade
- Depósitos com cadastro persistente
- Alertas de estoque baixo, ruptura e validade
- Auditoria de ações importantes
- Equipe e perfis: admin, manager, employee e viewer
- Scanner de código de barras pela câmera quando suportado pelo navegador
- Exportação de produtos para CSV
- Assistente IA com arquitetura preparada para integração de provedor
- Interface responsiva com design dark premium
- Estados de carregamento, erro e página 404
- CI com lint e build no GitHub Actions

## Stack

- Next.js 16 + React + TypeScript
- Supabase Auth + PostgreSQL
- Recharts
- Lucide React
- CSS responsivo com design system próprio
- GitHub Actions

## Estrutura

```
src/
  app/
    api/                 # APIs server-side
    dashboard/           # visão operacional
    produtos/            # catálogo
    compras/             # entradas de compra
    vendas/              # saídas de venda
    inventario/          # ajustes e contagem
    depositos/           # unidades logísticas
    alertas/             # central de alertas
    relatorios/          # indicadores
    equipe/              # usuários e permissões
    ia/                  # assistente
  components/
  lib/
supabase/
  migrations/
```

## Configuração local

Crie `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Instale e execute:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Banco de dados

Execute as migrations no SQL Editor do Supabase nesta ordem:

1. `001_initial_schema.sql`
2. `002_inventory_engine.sql`
3. `003_business_entities.sql`
4. `004_stockflow_pro.sql`
5. `005_stockflow_hardening.sql`
6. `006_roles_permissions.sql`
7. `007_operation_cancellation.sql`
8. `008_workspace_hardening.sql`
9. `009_warehouse_stock.sql`
10. `010_stock_warehouse_consistency.sql`
11. `011_stock_consistency_function.sql`
12. `012_operation_warehouse_binding.sql`
13. `013_stock_map.sql`

> As migrations são cumulativas. Execute cada uma uma única vez e, se alguma falhar, corrija a causa antes de avançar para a próxima.

## Próxima camada de produto

- Transferências reais entre depósitos com saldo por localização
- Curva ABC, giro e cobertura de estoque
- Sugestão automática de reposição
- Notificações e centro de tarefas
- Integração com fornecedores e emissão de pedidos
- Billing e planos SaaS
- Integrações externas e webhooks
- Testes automatizados de API e regras críticas
