using System.Text.Json;
using FantasyShelter.Server;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls(builder.Configuration["urls"] ?? "http://127.0.0.1:5080");
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 256 * 1024);
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins("http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:4173", "http://localhost:4173")
    .WithMethods("GET", "PUT", "POST").WithHeaders("Content-Type")));
builder.Services.AddSingleton<RunStore>();
var app = builder.Build();
app.UseCors();
var store = app.Services.GetRequiredService<RunStore>();
store.Initialize();
var settingsPath = Path.Combine(AppContext.BaseDirectory, "survival.json");
var settings = JsonDocument.Parse(File.ReadAllText(settingsPath)).RootElement.Clone();
var shelter = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "shelter.json"))).RootElement.Clone();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", database = "sqlite", schemaVersion = 1, checkpointVersion = 2 }));
app.MapGet("/api/config", () => Results.Ok(new { version = 2, survival = settings, shelter }));
app.MapGet("/api/checkpoint", () => store.Load() is { } json
    ? Results.Content(json, "application/json") : Results.NoContent());
app.MapPut("/api/checkpoint", (JsonElement checkpoint) =>
{
    var error = CheckpointValidator.Validate(checkpoint);
    if (error is not null) return Results.BadRequest(new { error });
    store.Save(checkpoint.GetRawText());
    return Results.Ok(new { saved = true });
});
app.MapPost("/api/runs", (RunResult result) =>
{
    if (!Guid.TryParse(result.RunId, out _) || result.Day is < 1 or > 100000 || result.Kills is < 0 or > 100000000 ||
        !double.IsFinite(result.Elapsed) || result.Elapsed is < 0 or > 1e9) return Results.BadRequest(new { error = "Invalid run result" });
    store.Record(result);
    return Results.Ok(new { recorded = true });
});
app.MapGet("/api/runs", () => Results.Ok(store.RecentRuns()));
app.Run();
