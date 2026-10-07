using System.Text.Json;

namespace FantasyShelter.Server;

/// <summary>Schema and bounds validation for local checkpoints. This is not anti-cheat validation.</summary>
public static class CheckpointValidator
{
    public static readonly int Version = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "checkpoint.json"))).RootElement.GetProperty("version").GetInt32();
    private static readonly JsonElement WorldBounds = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "world.json"))).RootElement.GetProperty("bounds").Clone();
    private static readonly JsonElement FinalBoss = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "encounters.json"))).RootElement.GetProperty("finalBoss").Clone();
    private static readonly JsonElement ArenaBounds = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "encounters.json"))).RootElement.GetProperty("finalArena").GetProperty("bounds").Clone();
    private static bool InArena(JsonElement p) => Position(p) && Field(p,"x").GetDouble()>ArenaBounds.GetProperty("minX").GetDouble()+.3 && Field(p,"x").GetDouble()<ArenaBounds.GetProperty("maxX").GetDouble()-.3 && Field(p,"z").GetDouble()>ArenaBounds.GetProperty("minZ").GetDouble()+.3 && Field(p,"z").GetDouble()<ArenaBounds.GetProperty("maxZ").GetDouble()-.3;
    private static readonly JsonElement Skills = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "skills.json"))).RootElement.Clone();
    private static readonly JsonElement Buildings = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "buildings.json"))).RootElement.Clone();
    private static readonly JsonElement Corruption = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "corruption.json"))).RootElement.Clone();
    private static readonly JsonElement Economy = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "economy.json"))).RootElement.Clone();
    private static readonly IReadOnlyDictionary<string, double> NodeHealth = LoadNodes();
    private static readonly JsonElement ShelterLayout = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "shelter.json"))).RootElement.Clone();
    private static readonly JsonElement Defense = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "defense.json"))).RootElement.Clone();
    private static readonly JsonElement ZombieTypes = JsonDocument.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "zombies.json"))).RootElement.GetProperty("types").Clone();
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
    private static bool Position(JsonElement value) => N(value, "x", WorldBounds.GetProperty("minX").GetDouble() + .3, WorldBounds.GetProperty("maxX").GetDouble() - .3) && N(value, "z", WorldBounds.GetProperty("minZ").GetDouble() + .3, WorldBounds.GetProperty("maxZ").GetDouble() - .3);
    private static bool Array(JsonElement value, int max) => value.ValueKind == JsonValueKind.Array && value.GetArrayLength() <= max && value.EnumerateArray().All(Object);
    private static bool Unique(JsonElement array, string key = "id") => array.EnumerateArray().Select(item => Field(item, key).ToString()).Distinct().Count() == array.GetArrayLength();

    private static readonly JsonElement[] Perks = Skills.GetProperty("branches").EnumerateObject().SelectMany(branch => branch.Value.EnumerateArray()).ToArray();
    private static Dictionary<string,double>? SkillBonuses(JsonElement levels) {
        if (!Object(levels) || levels.EnumerateObject().Count()!=Perks.Length) return null;
        var bonuses=Skills.GetProperty("bonusDefaults").EnumerateObject().ToDictionary(p=>p.Name,p=>p.Value.GetDouble());
        foreach(var perk in Perks) if(!N(levels,perk.GetProperty("id").GetString()!,0,perk.GetProperty("maxRank").GetInt32(),true)) return null;
        foreach(var branch in Skills.GetProperty("branches").EnumerateObject()) {
            var spent=branch.Value.EnumerateArray().Sum(perk=>Field(levels,perk.GetProperty("id").GetString()!).GetInt32());
            foreach(var perk in branch.Value.EnumerateArray()) {
                var rank=Field(levels,perk.GetProperty("id").GetString()!).GetInt32(); if(rank==0)continue;
                if(spent-rank<Skills.GetProperty("tierRequirements")[perk.GetProperty("tier").GetInt32()-1].GetInt32() || perk.GetProperty("requires").EnumerateArray().Any(req=>Field(levels,req.GetProperty("id").GetString()!).GetInt32()<req.GetProperty("rank").GetInt32())) return null;
                foreach(var effect in perk.GetProperty("effects").EnumerateObject())bonuses[effect.Name]+=effect.Value[rank-1].GetDouble();
            }
        }
        return bonuses;
    }
    public static string? Validate(JsonElement value)
    {
        if (!Object(value) || !N(value, "version", Version, Version) || !Guid.TryParse(Field(value, "runId").ToString(), out _) ||
            !DateTimeOffset.TryParse(Field(value, "savedAt").ToString(), out _) || !N(value, "elapsed", 0, 1e9) ||
            !N(value, "totalKills", 0, 1e8, true) || !N(value, "swordCooldown", 0, 1.4) || !N(value, "swordCooldownDuration", .1, 1.4) ||
            Field(value, "swordCooldown").GetDouble() > Field(value, "swordCooldownDuration").GetDouble()) return "Invalid checkpoint header";
        if (!N(value, "shelterLevel", 1, 3, true) || !N(value, "shelterHp", 0, Defense.GetProperty("levels")[Field(value, "shelterLevel").GetInt32() - 1].GetProperty("maxHp").GetDouble()) || !N(value, "repairCooldown", 0, 1.5)) return "Invalid Shelter";
        var encounters = Field(value, "encounters");
        if (!new[]{"forgeGuardianDefeated","graveGuardianDefeated","ravagerDefeated","finalBossDefeated"}.All(key=>Field(encounters,key).ValueKind is JsonValueKind.True or JsonValueKind.False) || Field(value,"finalArenaActive").ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return "Invalid encounters";
        var corruption = Field(value, "corruption");
        if (!N(corruption, "value", 0, Corruption.GetProperty("maximum").GetDouble()) || !N(corruption, "damageElapsed", 0, Corruption.GetProperty("damageInterval").GetDouble() - 1e-9)) return "Invalid corruption";
        var skills = Field(value, "skills"); var levels = Field(skills, "levels");
        var bonuses=SkillBonuses(levels);
        if (bonuses==null || !N(skills,"points",0,100003,true)) return "Invalid skills";
        var attackSpeed=bonuses["attackSpeed"];
        var cooldownDuration = Field(value, "swordCooldownDuration").GetDouble();
        if (Math.Abs(cooldownDuration - .65 / attackSpeed) > 1e-8 && Math.Abs(cooldownDuration - 1.4 / attackSpeed) > 1e-8) return "Invalid attack speed";
        var maxPlayerHp = Math.Round(100 * bonuses["maxHealth"]);
        var buildingHealth = bonuses["buildingHealth"];
        var player = Field(value, "player");
        if (!N(player, "hp", 0, maxPlayerHp) || !Position(Field(player, "position")) || !N(player, "yaw", -1e6, 1e6)) return "Invalid player";
        var outcome = Field(value, "outcome");
        if (!Is(outcome, "active", "won", "lost") || (Is(outcome, "lost") ? Field(player, "hp").GetDouble() > 0 && Field(value, "shelterHp").GetDouble() > 0 : Field(player, "hp").GetDouble() <= 0 || Field(value, "shelterHp").GetDouble() <= 0) || Is(outcome, "won") != Field(encounters, "finalBossDefeated").GetBoolean()) return "Invalid outcome";
        var cycle = Field(value, "cycle");
        if (!N(cycle, "day", 1, 100000, true) || !Is(Field(cycle, "period"), "day", "night") ||
            !N(cycle, "periodElapsed", 0, 1e9) || !N(cycle, "pendingSpawns", 0, 64, true) || !N(cycle, "waveSize", 0, 64, true) ||
            !N(cycle, "spawnCountdown", 0, 64) || !N(cycle, "patrolCountdown", 0, 3600)) return "Invalid cycle";
        var spentPoints = levels.EnumerateObject().Sum(p=>p.Value.GetInt32());
        if (spentPoints + Field(skills, "points").GetInt32() > Skills.GetProperty("initialPoints").GetInt32() + (Field(cycle, "day").GetInt32() - 1) * Skills.GetProperty("pointsPerDay").GetInt32()) return "Invalid skill budget";
        var settings = Field(value, "settings");
        foreach (var name in new[] { "dayDuration", "nightDuration", "patrolRespawnInterval" }) if (!N(settings, name, .01, 3600)) return "Invalid settings";
        foreach (var name in new[] { "baseWaveSize", "maxWaveSize", "maxAliveZombies" }) if (!N(settings, name, 1, 64, true)) return "Invalid settings";
        foreach (var name in new[] { "waveGrowth", "dayPatrolCount" }) if (!N(settings, name, 0, 64, true)) return "Invalid settings";
        if (!N(settings, "spawnInterval", .01, 64) || Field(settings, "baseWaveSize").GetInt32() > Field(settings, "maxWaveSize").GetInt32() ||
            Field(settings, "dayPatrolCount").GetInt32() > Field(settings, "maxAliveZombies").GetInt32()) return "Invalid settings";
        if (!N(settings, "miniWaveCount", 1, 8, true) || !N(settings, "miniWaveSpawnFraction", .1, .9)) return "Invalid mini-wave settings";
        var warnings = Field(settings, "warningSeconds");
        if (warnings.ValueKind != JsonValueKind.Array || warnings.GetArrayLength() > 8 || !warnings.EnumerateArray().All(warning => Number(warning, 1, 3600))) return "Invalid warnings";
        var abilities=Field(value,"abilities");var hazards=Field(value,"bossHazards");
        if(!Position(Field(abilities,"lastPosition")) || !N(abilities,"cloak",0,15) || !N(abilities,"shield",0,5) || !new[]{"cloakCooldown","barrageCooldown","demolitionCooldown","shieldCooldown"}.All(key=>N(abilities,key,0,90)) || !N(abilities,"sinceDamage",0,3600) || !N(abilities,"idle",0,3600) || (Field(abilities,"cloak").GetDouble()>0&&bonuses["cloak"]==0) || (Field(abilities,"shield").GetDouble()>0&&bonuses["combatMaster"]==0))return "Invalid ability state";
        if(!Array(hazards,0)) return "Invalid boss hazards";
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
            !Position(Field(building, "position")) || !N(building, "hp", 1, Buildings.GetProperty(Field(building, "kind").GetString()!).GetProperty("maxHp").GetDouble() * buildingHealth) || !N(building, "rotation", 0, Math.PI * 2) || !FitsBase(building)) return "Invalid building";
        var stores = buildings.EnumerateArray().Count(building => Is(Field(building, "kind"), "storehouse"));
        var resources = Field(value, "resources");
        if (!Object(resources) || resources.EnumerateObject().Count() != 2 || !N(resources, "wood", 0, Economy.GetProperty("shelterCapacity").GetProperty("wood").GetDouble() + stores * Economy.GetProperty("storehouseBonus").GetProperty("wood").GetDouble(), true) || !N(resources, "iron", 0, Economy.GetProperty("shelterCapacity").GetProperty("iron").GetDouble() + stores * Economy.GetProperty("storehouseBonus").GetProperty("iron").GetDouble(), true)) return "Invalid resource counters";
        var carried = Field(value, "carried");
        if (!Object(carried) || carried.EnumerateObject().Count() != 2 || !N(carried, "wood", 0, Economy.GetProperty("carriedCapacity").GetProperty("wood").GetDouble()+bonuses["carryWood"], true) || !N(carried, "iron", 0, Economy.GetProperty("carriedCapacity").GetProperty("iron").GetDouble()+bonuses["carryIron"], true)) return "Invalid backpack";
        foreach (var zombie in zombies.EnumerateArray())
        {
            if (!Is(Field(zombie, "kind"), "normal", "fast", "tank", "guardian", "warden", "ravager", "overlord")) return "Invalid zombie kind";
            if (!N(zombie,"chargeCooldown",0,FinalBoss.GetProperty("chargeInterval").GetDouble()) || !N(zombie,"chargeRemaining",0,FinalBoss.GetProperty("chargeDuration").GetDouble()) || Field(zombie,"chargeHit").ValueKind is not (JsonValueKind.True or JsonValueKind.False) || (Field(zombie,"chargeTarget").ValueKind!=JsonValueKind.Null && !Position(Field(zombie,"chargeTarget"))) || (Field(zombie,"chargeRemaining").GetDouble()>0 && Field(zombie,"chargeTarget").ValueKind==JsonValueKind.Null) || (!Is(Field(zombie,"kind"),"overlord") && (Field(zombie,"chargeRemaining").GetDouble()>0 || Field(zombie,"chargeTarget").ValueKind!=JsonValueKind.Null))) return "Invalid charge";
            var stats = ZombieTypes.GetProperty(Field(zombie, "kind").GetString()!);
            if (!Text(Field(zombie, "id")) || !N(zombie, "hp", 0, stats.GetProperty("hp").GetDouble()) || !Position(Field(zombie, "position")) ||
                !Position(Field(zombie, "origin")) || !Position(Field(zombie, "patrolTarget")) || !Is(Field(zombie, "mode"), "patrol", "siege", "guard") || !N(zombie,"specialCooldown",0,60) || !N(zombie,"summonCooldown",0,60) || !N(zombie,"retreatTimer",0,FinalBoss.GetProperty("resetAfter").GetDouble()) || !N(zombie,"slow",0,2) || !N(zombie, "windup", 0, 2) || (Field(zombie, "windupTarget").ValueKind != JsonValueKind.Null && !Position(Field(zombie, "windupTarget"))) || (Field(zombie, "windup").GetDouble() > 0 && Field(zombie, "windupTarget").ValueKind == JsonValueKind.Null) || (Is(Field(zombie, "kind"), "guardian", "warden", "ravager", "overlord") ? !Is(Field(zombie, "mode"), "guard") : Is(Field(zombie, "mode"), "guard")) ||
                !Is(Field(zombie, "intent"), "patrol", "shelter", "player", "guard") || !N(zombie, "attackCooldown", 0, stats.GetProperty("attackCooldown").GetDouble()) || !N(zombie, "deathAge", 0, 3)) return "Invalid zombie";
        }
        if (zombies.EnumerateArray().Count(z => Is(Field(z, "kind"), "guardian")) > 1 || (Field(encounters, "forgeGuardianDefeated").GetBoolean() && zombies.EnumerateArray().Any(z => Is(Field(z, "kind"), "guardian") && Field(z, "hp").GetDouble() > 0))) return "Invalid Guardian state";
        if (zombies.EnumerateArray().Count(z => Is(Field(z, "kind"), "overlord")) > 1 || (Field(encounters, "finalBossDefeated").GetBoolean() && zombies.EnumerateArray().Any(z => Is(Field(z, "kind"), "overlord") && Field(z, "hp").GetDouble() > 0))) return "Invalid final boss state";
        foreach (var (kind,flag) in new[]{("warden","graveGuardianDefeated"),("ravager","ravagerDefeated")}) if (zombies.EnumerateArray().Count(z=>Is(Field(z,"kind"),kind))>1 || Field(encounters,flag).GetBoolean() && zombies.EnumerateArray().Any(z=>Is(Field(z,"kind"),kind)&&Field(z,"hp").GetDouble()>0)) return "Invalid boss state";
        var finalAlive=zombies.EnumerateArray().Any(z=>Is(Field(z,"kind"),"overlord")&&Field(z,"hp").GetDouble()>0);
        if (Field(value,"finalArenaActive").GetBoolean()!=finalAlive || finalAlive && (!InArena(Field(player,"position")) || Field(encounters,"finalBossDefeated").GetBoolean() || zombies.EnumerateArray().Any(z=>Is(Field(z,"kind"),"overlord")&&!InArena(Field(z,"position"))))) return "Invalid closed arena";
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
        if (kind == "arcane-core")
        {
            var p = Field(building, "position");
            if (!ShelterLayout.GetProperty("generatorPads").EnumerateArray().Any(pad =>
                Math.Sqrt(Math.Pow(p.GetProperty("x").GetDouble() - pad.GetProperty("x").GetDouble(), 2) +
                          Math.Pow(p.GetProperty("z").GetDouble() - pad.GetProperty("z").GetDouble(), 2)) <= .05)) return false;
        }
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
