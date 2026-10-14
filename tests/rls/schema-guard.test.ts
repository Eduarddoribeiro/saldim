import { describe, expect, it } from 'vitest'
import { withLocalDb } from './helpers'

// Rede de segurança: falha se alguma tabela de `public` (presente ou futura) ficar sem as proteções
// definidas em docs/plano.md → "Segurança (Supabase)". Lê o catálogo do Postgres local.

type Row = Record<string, string>

async function query(sql: string): Promise<Row[]> {
  return withLocalDb(async (db) => (await db.query(sql)).rows)
}

describe('regras de segurança do esquema public', () => {
  it('existe pelo menos uma tabela (o teste não passa por estar vazio)', async () => {
    const rows = await query(`select tablename from pg_tables where schemaname = 'public'`)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('todas as tabelas têm RLS ativada', async () => {
    const rows = await query(`
      select c.relname as tabela
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)
    expect(rows.map((row) => row.tabela)).toEqual([])
  })

  it('todas as tabelas têm políticas (RLS sem políticas = tabela inutilizável)', async () => {
    const rows = await query(`
      select t.tablename as tabela
      from pg_tables t
      where t.schemaname = 'public'
        and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)`)
    expect(rows.map((row) => row.tabela)).toEqual([])
  })

  it('nenhuma política se aplica a anon ou public — só a authenticated', async () => {
    const rows = await query(`
      select tablename || ': ' || policyname as politica, array_to_string(roles, ',') as papeis
      from pg_policies
      where schemaname = 'public' and roles <> '{authenticated}'`)
    expect(rows).toEqual([])
  })

  it('o papel anon não tem privilégios nas tabelas', async () => {
    const rows = await query(`
      select table_name || ': ' || privilege_type as privilegio
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee = 'anon'`)
    expect(rows.map((row) => row.privilegio)).toEqual([])
  })

  it('funções security definer de public não podem ser executadas por anon/authenticated', async () => {
    const rows = await query(`
      select p.proname as funcao
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and (has_function_privilege('anon', p.oid, 'execute')
          or has_function_privilege('authenticated', p.oid, 'execute'))`)
    expect(rows.map((row) => row.funcao)).toEqual([])
  })
})
