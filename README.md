# StockFlow

Sistema SaaS de gestão de estoque construído com Next.js, TypeScript e Supabase.

## Recursos

- Autenticação e criação automática da empresa
- Dashboard operacional
- Produtos com SKU, código de barras, marca, lote e validade
- Categorias, fornecedores e clientes
- Compras, vendas, entradas e saídas
- Controle de estoque com movimentações atômicas
- Inventário físico com ajuste automático de divergências
- Depósitos
- Alertas de estoque baixo, ruptura e validade próxima
- Relatórios operacionais
- Auditoria de ações importantes
- Arquitetura multiempresa por company_id
- Interface responsiva para desktop e celular

## Stack

- Next.js + React + TypeScript
- Supabase Auth + PostgreSQL
- CSS responsivo
- Recharts

## Desenvolvimento

Crie .env.local com:

    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_ANON_KEY=...

Instale e execute:

    npm install
    npm run dev

Depois acesse http://localhost:3000.

## Banco de dados

Execute as migrations nesta ordem no SQL Editor do Supabase:

1. supabase/migrations/001_initial_schema.sql
2. supabase/migrations/002_inventory_engine.sql
3. supabase/migrations/003_business_entities.sql
4. supabase/migrations/004_stockflow_pro.sql
5. supabase/migrations/005_stockflow_hardening.sql
6. supabase/migrations/006_roles_permissions.sql
7. supabase/migrations/007_operation_cancellation.sql

As migrations 004 e 005 adicionam depósitos, inventário físico, auditoria, campos avançados de produto e regras adicionais de segurança.

## Próximas evoluções

- Leitura de código de barras pela câmera
- Transferência entre depósitos
- Exportação de relatórios
- Indicadores avançados e curva ABC
- Assistente inteligente baseado nos dados da empresa
- Planos SaaS e cobrança
