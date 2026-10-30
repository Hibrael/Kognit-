using System.Globalization;

namespace Kognit.Api.Infrastructure;

/// <summary>
/// "Hoje" no fuso America/Sao_Paulo (especificação 16.7). Em desenvolvimento aceita ?hoje=AAAA-MM-DD ou o
/// cabeçalho X-Hoje, como exige o contrato, para reproduzir a seção 7 (contracts/check.mjs).
/// </summary>
public sealed class Clock(IHttpContextAccessor http, IConfiguration config)
{
    private static readonly TimeZoneInfo Sp = TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");

    public static DateOnly TodayInSaoPaulo() => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Sp).DateTime);

    /// <summary>Data local de um instante (ex.: postTime de uma notificação, 8.3).</summary>
    public static DateOnly DateInSaoPaulo(DateTimeOffset instant) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(instant, Sp).DateTime);

    public DateOnly Today
    {
        get
        {
            if (config.GetValue<bool>("Features:AllowTodayOverride") && http.HttpContext is { } ctx)
            {
                var raw = ctx.Request.Query["hoje"].FirstOrDefault() ?? ctx.Request.Headers["X-Hoje"].FirstOrDefault();
                if (DateOnly.TryParseExact(raw, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)) return d;
            }
            return TodayInSaoPaulo();
        }
    }
}
