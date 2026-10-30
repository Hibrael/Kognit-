using System.Text;
using Kognit.Api.Data;
using Kognit.Api.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

// Base do backend em C#. Convenções do contrato (contracts/openapi.yaml, docs/ARQUITETURA.md) já ligadas:
// CORS, erros { error, field }, ?hoje= em desenvolvimento, JWT e Server-Sent Events.
// As rotas de cada fase entram em Endpoints/ (ver backend/README.md).

var builder = WebApplication.CreateBuilder(args);

var jwtKey = builder.Configuration["Auth:JwtKey"] ?? "";
if (Encoding.UTF8.GetByteCount(jwtKey) < 32)
    throw new InvalidOperationException("Configure Auth:JwtKey (≥ 32 caracteres) em user-secrets ou variável de ambiente.");

builder.Services.AddDbContext<AppDb>(o => o
    .UseNpgsql(builder.Configuration.GetConnectionString("Db"))
    .UseSnakeCaseNamingConvention());
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<Clock>();
builder.Services.AddSingleton<EventBroker>();
builder.Services.AddScoped<IHouseholdResolver, NoHouseholdResolver>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
    .AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MapInboundClaims = false;
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = "minhascontas",
        ValidAudience = "minhascontas",
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.FromMinutes(2),
    };
});
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseContractErrors();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/health", (Clock clock) => new { ok = true, today = clock.Today });

// F3: trocar pelos métodos configurados (Google, link mágico, dev)
app.MapGet("/api/auth/options", () => new { google = false, magicLink = false, dev = false });

EventBroker.MapEvents(app);

app.Run();

public partial class Program;
