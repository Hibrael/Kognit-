using System.Collections.Concurrent;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Channels;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;

namespace Kognit.Api.Infrastructure;

/// <summary>Descobre a casa do usuário logado. Implementar na F3 (household_members).</summary>
public interface IHouseholdResolver
{
    Task<Guid?> HouseholdOfAsync(ClaimsPrincipal user, CancellationToken ct);
}

/// <summary>Enquanto a F3 não existe, ninguém tem casa e /api/events responde 401.</summary>
public sealed class NoHouseholdResolver : IHouseholdResolver
{
    public Task<Guid?> HouseholdOfAsync(ClaimsPrincipal user, CancellationToken ct) => Task.FromResult<Guid?>(null);
}

/// <summary>
/// Tempo real do contrato (docs/ARQUITETURA.md): Server-Sent Events por casa.
/// Toda escrita chama <see cref="Changed"/>; o vínculo automático (8.7) chama <see cref="Notice"/>.
/// </summary>
public sealed class EventBroker
{
    private readonly ConcurrentDictionary<Guid, ConcurrentDictionary<Guid, Channel<string>>> _subs = new();

    public void Changed(Guid household) => Publish(household, "changed", new { });

    public void Notice(Guid household, string message, object? undo = null) => Publish(household, "notice", new { message, undo });

    private void Publish(Guid household, string evt, object data)
    {
        if (!_subs.TryGetValue(household, out var subs)) return;
        var frame = $"event: {evt}\ndata: {JsonSerializer.Serialize(data, JsonSerializerOptions.Web)}\n\n";
        foreach (var ch in subs.Values) ch.Writer.TryWrite(frame);
    }

    public async Task StreamAsync(Guid household, HttpResponse res, CancellationToken ct)
    {
        var id = Guid.NewGuid();
        var ch = Channel.CreateBounded<string>(new BoundedChannelOptions(100) { FullMode = BoundedChannelFullMode.DropOldest });
        _subs.GetOrAdd(household, _ => new()).TryAdd(id, ch);
        res.Headers.ContentType = "text/event-stream";
        res.Headers.CacheControl = "no-cache";
        res.Headers["X-Accel-Buffering"] = "no";
        try
        {
            await res.WriteAsync(": conectado\n\n", ct);
            await res.Body.FlushAsync(ct);
            while (!ct.IsCancellationRequested)
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(TimeSpan.FromSeconds(25));
                string frame;
                try { frame = await ch.Reader.ReadAsync(timeout.Token); }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested) { frame = ": ping\n\n"; }
                await res.WriteAsync(frame, ct);
                await res.Body.FlushAsync(ct);
            }
        }
        catch (OperationCanceledException) { /* aparelho desconectou */ }
        finally
        {
            if (_subs.TryGetValue(household, out var subs)) subs.TryRemove(id, out _);
        }
    }

    /// <summary>GET /api/events?access_token=... (EventSource não envia cabeçalhos).</summary>
    public static void MapEvents(WebApplication app) => app.MapGet("/api/events", async (HttpContext ctx, EventBroker broker,
        IHouseholdResolver resolver, IOptionsMonitor<JwtBearerOptions> jwt) =>
    {
        var token = ctx.Request.Query["access_token"].FirstOrDefault();
        if (string.IsNullOrEmpty(token)) return Results.Unauthorized();
        var p = jwt.Get(JwtBearerDefaults.AuthenticationScheme).TokenValidationParameters;
        var result = await new Microsoft.IdentityModel.JsonWebTokens.JsonWebTokenHandler().ValidateTokenAsync(token, p);
        if (!result.IsValid) return Results.Unauthorized();
        var household = await resolver.HouseholdOfAsync(new ClaimsPrincipal(result.ClaimsIdentity), ctx.RequestAborted);
        if (household is null) return Results.Unauthorized();
        await broker.StreamAsync(household.Value, ctx.Response, ctx.RequestAborted);
        return Results.Empty;
    });
}
