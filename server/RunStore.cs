using Microsoft.Data.Sqlite;

namespace FantasyShelter.Server;

public sealed record RunResult(string RunId, int Day, int Kills, double Elapsed, string Outcome = "lost");

/// <summary>Prototype persistence boundary. No simulation state lives in SQL transactions.</summary>
public sealed class RunStore
{
    private readonly string connectionString;
    public RunStore(IConfiguration config, IWebHostEnvironment environment)
    {
        var directory = Path.GetFullPath(config["DataDirectory"] ?? Path.Combine(environment.ContentRootPath, "Data"));
        Directory.CreateDirectory(directory);
        connectionString = new SqliteConnectionStringBuilder { DataSource = Path.Combine(directory, "shelter.db"), DefaultTimeout = 5 }.ToString();
    }
    private SqliteConnection Open()
    {
        var connection = new SqliteConnection(connectionString);
        connection.Open();
        return connection;
    }
    public void Initialize()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS SchemaInfo (Version INTEGER PRIMARY KEY);
            INSERT OR IGNORE INTO SchemaInfo VALUES (1);
            CREATE TABLE IF NOT EXISTS Checkpoints (Slot INTEGER PRIMARY KEY CHECK (Slot=1), Json TEXT NOT NULL, UpdatedAt TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS Runs (RunId TEXT PRIMARY KEY, Day INTEGER NOT NULL, Kills INTEGER NOT NULL, Elapsed REAL NOT NULL, FinishedAt TEXT NOT NULL, Outcome TEXT NOT NULL DEFAULT 'lost');
            """;
        command.ExecuteNonQuery();
        using var columns = connection.CreateCommand(); columns.CommandText = "PRAGMA table_info(Runs)";
        bool hasOutcome;
        using (var reader = columns.ExecuteReader()) { var names = new List<string>(); while (reader.Read()) names.Add(reader.GetString(1)); hasOutcome = names.Contains("Outcome"); }
        if (!hasOutcome) { command.CommandText = "ALTER TABLE Runs ADD COLUMN Outcome TEXT NOT NULL DEFAULT 'lost'"; command.ExecuteNonQuery(); }
        command.CommandText = "INSERT OR IGNORE INTO SchemaInfo VALUES (2)"; command.ExecuteNonQuery();
    }
    public string? Load()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Json FROM Checkpoints WHERE Slot=1";
        return command.ExecuteScalar() as string;
    }
    public void Save(string json)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "INSERT INTO Checkpoints (Slot, Json, UpdatedAt) VALUES (1, $json, $time) ON CONFLICT(Slot) DO UPDATE SET Json=excluded.Json, UpdatedAt=excluded.UpdatedAt";
        command.Parameters.AddWithValue("$json", json);
        command.Parameters.AddWithValue("$time", DateTimeOffset.UtcNow.ToString("O"));
        command.ExecuteNonQuery();
    }
    public void Record(RunResult result)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "INSERT OR IGNORE INTO Runs (RunId, Day, Kills, Elapsed, FinishedAt, Outcome) VALUES ($id, $day, $kills, $elapsed, $time, $outcome)";
        command.Parameters.AddWithValue("$id", result.RunId);
        command.Parameters.AddWithValue("$day", result.Day);
        command.Parameters.AddWithValue("$kills", result.Kills);
        command.Parameters.AddWithValue("$elapsed", result.Elapsed);
        command.Parameters.AddWithValue("$outcome", result.Outcome);
        command.Parameters.AddWithValue("$time", DateTimeOffset.UtcNow.ToString("O"));
        command.ExecuteNonQuery();
    }
    public IReadOnlyList<RunResult> RecentRuns()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT RunId, Day, Kills, Elapsed, Outcome FROM Runs ORDER BY FinishedAt DESC LIMIT 20";
        using var reader = command.ExecuteReader();
        var results = new List<RunResult>();
        while (reader.Read()) results.Add(new(reader.GetString(0), reader.GetInt32(1), reader.GetInt32(2), reader.GetDouble(3), reader.GetString(4)));
        return results;
    }
}
