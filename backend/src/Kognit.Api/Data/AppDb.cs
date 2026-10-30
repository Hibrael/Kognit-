using Microsoft.EntityFrameworkCore;

namespace Kognit.Api.Data;

/// <summary>
/// Banco da especificação, seção 5.2 (mesmos nomes de tabelas e colunas; a convenção snake_case do EF já
/// gera os nomes). As tabelas entram fase a fase como migrações (dotnet ef migrations add ...).
///
/// Isolamento por casa (substitui as políticas RLS): guardar a casa da requisição aqui e usar filtros globais
/// (HasQueryFilter) por household_id, e deleted_at is null em transactions.
/// </summary>
public class AppDb(DbContextOptions<AppDb> options) : DbContext(options)
{
    public Guid CurrentHouseholdId { get; set; }
}
