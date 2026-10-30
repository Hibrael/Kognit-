using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Kognit.Tests;

/// <summary>
/// Convenções do contrato que a base já cumpre. Os testes de domínio da F1 (todas as tabelas e cenários da
/// seção 7 e os exemplos de parseMoney da 6.9) entram nesta pasta junto com o Kognit.Domain.
/// </summary>
public class BaseConventionsTests(WebApplicationFactory<Program> factory) : IClassFixture<WebApplicationFactory<Program>>
{
    private sealed record Health(bool Ok, DateOnly Today);

    [Fact]
    public async Task Hoje_override_in_development()
    {
        var h = await factory.CreateClient().GetFromJsonAsync<Health>("/api/health?hoje=2026-10-29");
        Assert.Equal(new DateOnly(2026, 10, 29), h!.Today);
    }

    [Fact]
    public async Task Events_require_token()
    {
        var res = await factory.CreateClient().GetAsync("/api/events");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Cors_allows_app_origins()
    {
        var req = new HttpRequestMessage(HttpMethod.Options, "/api/health");
        req.Headers.Add("Origin", "https://localhost");
        req.Headers.Add("Access-Control-Request-Method", "GET");
        var res = await factory.CreateClient().SendAsync(req);
        Assert.Equal("https://localhost", res.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }
}
