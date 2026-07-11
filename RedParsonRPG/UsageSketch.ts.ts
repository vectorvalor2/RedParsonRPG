import * as RED from "./src/engine/index";

const assets = new RED.AssetRegistry();
const semantics = new RED.SemanticGraph();
const checkpoints = new RED.CheckpointStack(64);
const safety = new RED.SafetyLayer(semantics);
const loader = new RED.AssetLoader(assets);

// Load a model
const asset = await loader.loadGLTF("/models/chair.glb", {
  id: "chair-01", tags: ["furniture"], sizeBytes: 0, provenance: "local", complexity: 0.3
});

// Tag it semantically
const socket = semantics.addTag({ id: RED.uuid(), kind: "socket", label: "seat", confidence: 0.9 });
const plug = semantics.addTag({ id: RED.uuid(), kind: "plug", label: "leg", confidence: 0.85 });

// Discover valid links
const candidates = semantics.findCandidates(socket);

// Link them
semantics.link(socket.id, plug.id, "plug-into-socket");

// Checkpoint before moving
checkpoints.register(asset!.object);
checkpoints.snapshot("before move");

// Move, then undo
asset!.object.position.x += 3;
checkpoints.undo();

// Safety audit
const report = safety.audit(assets.all());
console.log(report.overallRisk, report.recommendations);

// Serialize
const serializer = new RED.SceneSerializer(assets, semantics, checkpoints);
const red = serializer.export("My Scene", "dev", "Level 1");
const json = serializer.stringify(red);
// → save to disk as scene.red
