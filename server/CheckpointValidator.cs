using System.Text.Json;

namespace FantasyShelter.Server;

/// <summary>Schema and bounds validation for local checkpoints. This is not anti-cheat validation.</summary>
public static class CheckpointValidator
{
    private static readonly IReadOnlyDictionary<string, double> NodeHealth = LoadNodes();
    private static readonly JsonElement ShelterLayout = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "shelter.json"))).RootElement.Clone();
    private static IReadOnlyDictionary<string, double> LoadNodes()
    {
        using var nodes = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "resources.json")));
        using var definitions = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "harvesting.json")));
        return nodes.RootElement.EnumerateArray().ToDictionary(node => node.GetProperty("id").GetString()!,
            node => definitions.RootElement.GetProperty(node.GetProperty("type").GetString()!).GetProperty("maxHealth").GetDouble());
    }
    private static bool Object(JsonElement value) => value.ValueKind == JsonValueKind.Object;
    private static JsonElement Field(JsonElement value, string key) => Object(value) && value.TryGetProperty(key, out var result) ? result : default;
    private static bool Number(JsonElement value, double min, double max, bool integer = false) =>
        value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var number) && double.IsFinite(number) && number >= min && number <= max && (!integer || Math.Truncate(number) == number);
    private static bool N(JsonElement value, string key, double min, double max, bool integer = false) => Number(Field(value, key), min, max, integer);
    private static bool Text(JsonElement value, int max = 64) => value.ValueKind == JsonValueKind.String && value.GetString() is { Length: > 0 } text && text.Length <= max;
    private static bool Is(JsonElement value, params string[] choices) => value.ValueKind == JsonValueKind.String && choices.Contains(value.GetString());
    private static bool Position(JsonElement value) => N(value, "x", -47.7, 47.7) && N(value, "z", -45.7, 51.7);
    private static bool Array(JsonElement value, int max) => value.ValueKind == JsonValueKind.Array && value.GetArrayLength() <= max && value.EnumerateArray().All(Object);
    private static bool Unique(JsonElement array, string key = "id") => array.EnumerateArray().Select(item => Field(item, key).ToString()).Distinct().Count() == array.GetArrayLength();

    public static string? Validate(JsonElement value)
    {
        if (!Object(value) || !N(value, "version", 2, 2) || !Guid.TryParse(Field(value, "runId").ToString(), out _) ||
            !DateTimeOffset.TryParse(Field(value, "savedAt").ToString(), out _) || !N(value, "elapsed", 0, 1e9) ||
            !N(value, "totalKills", 0, 1e8, true) || !N(value, "swordCooldown", 0, .65) || !N(value, "shelterHp", 1, 300)) return "Invalid checkpoint header";
        var player = Field(value, "player");
        if (!N(player, "hp", 1, 100) || !Position(Field(player, "position")) || !N(player, "yaw", -1e6, 1e6)) return "Invalid player";
        var cycle = Field(value, "cycle");
        if (!N(cycle, "day", 1, 100000, true) || !Is(Field(cycle, "period"), "day", "night") ||
            !N(cycle, "periodElapsed", 0, 1e9) || !N(cycle, "pendingSpawns", 0, 64, true) || !N(cycle, "waveSize", 0, 64, true) ||
            !N(cycle, "spawnCountdown", 0, 64) || !N(cycle, "patrolCountdown", 0, 3600)) return "Invalid cycle";
        var settings = Field(value, "settings");
        foreach (var name in new[] { "dayDuration", "nightMinimumDuration", "patrolRespawnInterval" }) if (!N(settings, name, .01, 3600)) return "Invalid settings";
        foreach (var name in new[] { "baseWaveSize", "maxWaveSize", "maxAliveZombies" }) if (!N(settings, name, 1, 64, true)) return "Invalid settings";
        foreach (var name in new[] { "waveGrowth", "dayPatrolCount" }) if (!N(settings, name, 0, 64, true)) return "Invalid settings";
        if (!N(settings, "spawnInterval", .01, 64) || Field(settings, "baseWaveSize").GetInt32() > Field(settings, "maxWaveSize").GetInt32() ||
            Field(settings, "dayPatrolCount").GetInt32() > Field(settings, "maxAliveZombies").GetInt32()) return "Invalid settings";
        var spawner = Field(value, "spawner");
        if (!N(spawner, "seed", 0, uint.MaxValue, true) || !N(spawner, "nextId", 1, 1e9, true)) return "Invalid spawner";
        var nodes = Field(value, "nodes"); var buildings = Field(value, "buildings"); var zombies = Field(value, "zombies");
        var towers = Field(value, "towers"); var shots = Field(value, "projectiles");
        if (!Array(nodes, NodeHealth.Count) || nodes.GetArrayLength() != NodeHealth.Count || !Unique(nodes) || !Array(buildings, 200) || !Unique(buildings) ||
            !Array(zombies, 100) || !Unique(zombies) || !Array(towers, 200) || !Unique(towers, "buildingId") || !Array(shots, 400) || !Unique(shots)) return "Invalid collections";
        foreach (var node in nodes.EnumerateArray())
        {
            var name = Field(node, "id").ToString();
            if (!NodeHealth.TryGetValue(name, out var maximum) || !N(node, "health", 0, maximum)) return "Invalid resource node";
        }
        foreach (var building in buildings.EnumerateArray()) if (!Text(Field(building, "id")) || !Is(Field(building, "kind"), "storehouse", "arcane-core", "magic-tower") ||
            !Position(Field(building, "position")) || !N(building, "rotation", 0, Math.PI * 2) || !FitsBase(building)) return "Invalid building";
        var stores = buildings.EnumerateArray().Count(building => Is(Field(building, "kind"), "storehouse"));
        var resources = Field(value, "resources");
        if (!Object(resources) || resources.EnumerateObject().Count() != 2 || !N(resources, "wood", 0, 100 + stores * 50, true) || !N(resources, "iron", 0, 50 + stores * 25, true)) return "Invalid resource counters";
        foreach (var zombie in zombies.EnumerateArray()) if (!Text(Field(zombie, "id")) || !N(zombie, "hp", 0, 100) || !Position(Field(zombie, "position")) ||
            !Position(Field(zombie, "origin")) || !Position(Field(zombie, "patrolTarget")) || !Is(Field(zombie, "mode"), "patrol", "siege") ||
            !Is(Field(zombie, "intent"), "patrol", "shelter", "player") || !N(zombie, "attackCooldown", 0, 1.2) || !N(zombie, "deathAge", 0, 3)) return "Invalid zombie";
        var ids = buildings.EnumerateArray().Select(building => Field(building, "id").ToString()).ToHashSet();
        foreach (var tower in towers.EnumerateArray()) if (!ids.Contains(Field(tower, "buildingId").ToString()) ||
            (Field(tower, "targetId").ValueKind != JsonValueKind.Null && !Text(Field(tower, "targetId"))) || !N(tower, "yaw", -Math.PI, Math.PI) ||
            !N(tower, "cooldown", 0, 1.2) || Field(tower, "powered").ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return "Invalid tower";
        foreach (var shot in shots.EnumerateArray()) if (!N(shot, "id", 1, 1e9, true) || !ids.Contains(Field(shot, "sourceId").ToString()) ||
            !Text(Field(shot, "targetId")) || !Position(Field(shot, "position")) || !N(Field(shot, "position"), "y", 0, 5) || !N(shot, "lifetime", 0, 3)) return "Invalid projectile";
        return null;
    }
    private static bool FitsBase(JsonElement building)
    {
        var kind = Field(building, "kind").GetString();
        var (width, depth) = kind == "storehouse" ? (2.8, 2.2) : kind == "arcane-core" ? (1.8, 1.8) : (1.6, 1.6);
        var angle = Field(building, "rotation").GetDouble();
        var halfW = (width * Math.Abs(Math.Cos(angle)) + depth * Math.Abs(Math.Sin(angle))) / 2;
        var halfD = (depth * Math.Abs(Math.Cos(angle)) + width * Math.Abs(Math.Sin(angle))) / 2;
        var bounds = ShelterLayout.GetProperty("bounds"); var margin = ShelterLayout.GetProperty("wallThickness").GetDouble();
        var position = Field(building, "position"); var x = Field(position, "x").GetDouble(); var z = Field(position, "z").GetDouble();
        return x - halfW >= bounds.GetProperty("minX").GetDouble() + margin && x + halfW <= bounds.GetProperty("maxX").GetDouble() - margin &&
            z - halfD >= bounds.GetProperty("minZ").GetDouble() + margin && z + halfD <= bounds.GetProperty("maxZ").GetDouble() - margin;
    }
}
