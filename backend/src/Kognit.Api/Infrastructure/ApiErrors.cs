using Microsoft.AspNetCore.Diagnostics;

namespace Kognit.Api.Infrastructure;

/// <summary>
/// Formato de erro do contrato: { "error": "mensagem para o usuário", "field": "campo opcional" }.
/// O front mostra "error" como está, então a mensagem é em português e voltada a quem usa o app.
/// </summary>
public static class ApiErrors
{
    public static IResult BadRequest(string error, string? field = null) => Results.Json(new { error, field }, statusCode: 400);
    public static IResult Forbidden(string error) => Results.Json(new { error }, statusCode: 403);
    public static IResult NotFound(string error = "Não encontrado") => Results.Json(new { error }, statusCode: 404);
    public static IResult Conflict(string error, string? field = null) => Results.Json(new { error, field }, statusCode: 409);
    public static IResult TooMany(string error) => Results.Json(new { error }, statusCode: 429);

    /// <summary>Exceção não tratada vira 500 no formato do contrato, sem vazar detalhes.</summary>
    public static void UseContractErrors(this WebApplication app) =>
        app.UseExceptionHandler(e => e.Run(async ctx =>
        {
            var ex = ctx.Features.Get<IExceptionHandlerFeature>()?.Error;
            ctx.RequestServices.GetRequiredService<ILogger<Program>>().LogError(ex, "erro não tratado");
            ctx.Response.StatusCode = 500;
            await ctx.Response.WriteAsJsonAsync(new { error = "Não foi salvo · Tentar de novo" });
        }));
}
