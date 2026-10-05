import { Color3, CreateBox, CreateCylinder, CreateSphere, Scene, StandardMaterial, TransformNode } from '../rendering/babylon';
import type { Mesh } from '../rendering/babylon';
import type { ResourceNode } from './ResourceNode';
import { ResourceType } from './ResourceType';

interface NodeView { root: TransformNode; visual: TransformNode; collider: Mesh; hitTime: number }

export class ResourceView {
  private readonly views = new Map<string, NodeView>();

  constructor(scene: Scene, nodes: readonly ResourceNode[]) {
    const wood = new StandardMaterial('resource-wood', scene);
    wood.diffuseColor = Color3.FromHexString('#866b43');
    const iron = new StandardMaterial('resource-iron', scene);
    iron.diffuseColor = Color3.FromHexString('#444946');
    iron.specularColor = Color3.Black();
    const ironVein = new StandardMaterial('resource-iron-veins', scene);
    ironVein.diffuseColor = Color3.FromHexString('#8c6d55');
    ironVein.specularColor = new Color3(0.12, 0.12, 0.12);
    const barkEnd = new StandardMaterial('resource-cut-wood', scene);
    barkEnd.diffuseColor = Color3.FromHexString('#baa474');
    for (const node of nodes) {
      const root = new TransformNode(`resource-${node.id}`, scene);
      root.position.set(node.position.x, 0, node.position.z);
      const visual = new TransformNode(`resource-visual-${node.id}`, scene);
      visual.parent = root;
      const finish = (mesh: Mesh, mat: StandardMaterial): void => {
        mesh.parent = visual;
        mesh.material = mat;
        mesh.isPickable = false;
      };
      if (node.resourceType === ResourceType.Wood) {
        const trunk = CreateCylinder(`trunk-${node.id}`, { diameter: 0.88, height: 2.5, tessellation: 9 }, scene);
        trunk.position.y = 0.47;
        trunk.rotation.z = Math.PI / 2;
        finish(trunk, wood);
        for (const side of [-1, 1]) {
          const end = CreateCylinder(`cut-${node.id}-${side}`, { diameter: 0.7, height: 0.025, tessellation: 9 }, scene);
          end.position.set(side * 1.26, 0.47, 0);
          end.rotation.z = Math.PI / 2;
          finish(end, barkEnd);
        }
      } else if (node.resourceType === ResourceType.Iron) {
        // A low irregular rock cluster with exposed ore, instead of a gemstone silhouette.
        for (const [index, rock] of [
          { x: -0.22, y: 0.46, z: 0.04, sx: 1.12, sy: 0.85, sz: 0.98 },
          { x: 0.43, y: 0.29, z: 0.13, sx: 0.6, sy: 0.52, sz: 0.71 },
          { x: -0.42, y: 0.24, z: -0.36, sx: 0.58, sy: 0.45, sz: 0.57 },
          { x: 0.06, y: 0.25, z: -0.4, sx: 0.66, sy: 0.47, sz: 0.54 },
        ].entries()) {
          const ore = CreateSphere(`ore-rock-${node.id}-${index}`, { diameter: 1, segments: 3 }, scene);
          const vertices = ore.getVerticesData('position')!;
          for (let vertex = 0; vertex < vertices.length; vertex += 3) {
            const roughness = 1 + 0.12 * Math.sin(vertices[vertex] * 19 + vertices[vertex + 1] * 23 + vertices[vertex + 2] * 17 + index);
            vertices[vertex] *= roughness;
            vertices[vertex + 1] *= roughness;
            vertices[vertex + 2] *= roughness;
          }
          ore.setVerticesData('position', vertices);
          ore.convertToFlatShadedMesh();
          ore.position.set(rock.x, rock.y, rock.z);
          ore.scaling.set(rock.sx, rock.sy, rock.sz);
          ore.rotation.set(0.13 * index, 0.7 * index, 0.11 * index);
          finish(ore, iron);
        }
        // Thin, partly embedded mineral patches follow the rock face.
        for (const [i, patch] of [
          { x: -0.42, y: 0.54, z: -0.39, tilt: -0.6 },
          { x: -0.22, y: 0.62, z: -0.40, tilt: 0.35 },
          { x: -0.05, y: 0.53, z: -0.42, tilt: -0.25 },
          { x: -0.18, y: 0.80, z: -0.14, tilt: 0.8 },
          { x: 0.40, y: 0.39, z: -0.16, tilt: 0.3 },
        ].entries()) {
          const vein = CreateSphere(`ore-vein-${node.id}-${i}`, { diameter: 1, segments: 3 }, scene);
          vein.scaling.set(0.09 + i * 0.012, 0.17, 0.035);
          vein.position.set(patch.x, patch.y, patch.z);
          vein.rotation.set(i === 3 ? -0.9 : -0.15, 0, patch.tilt);
          vein.convertToFlatShadedMesh();
          finish(vein, ironVein);
        }
      }
      const collider = CreateBox(`resource-collider-${node.id}`, { width: node.definition.width, height: node.definition.height, depth: node.definition.depth }, scene);
      collider.parent = root;
      collider.position.y = node.definition.height / 2;
      collider.isVisible = false;
      collider.checkCollisions = true;
      collider.isPickable = true;
      collider.metadata = { resourceNodeId: node.id };
      root.computeWorldMatrix(true);
      collider.computeWorldMatrix(true);
      this.views.set(node.id, { root, visual, collider, hitTime: 0 });
    }
  }

  hit(nodeId: string): void {
    const view = this.views.get(nodeId);
    if (view) view.hitTime = 0.18;
  }

  update(nodes: readonly ResourceNode[], time: number, dt = 0): void {
    for (const node of nodes) {
      const view = this.views.get(node.id)!;
      view.root.setEnabled(!node.isDestroyed);
      view.collider.checkCollisions = view.collider.isPickable = !node.isDestroyed;
      view.hitTime = Math.max(0, view.hitTime - dt);
      view.visual.rotation.z = view.hitTime > 0 ? Math.sin(time * 55) * 0.035 : 0;
      if (view.root.position.x !== node.position.x || view.root.position.z !== node.position.z) {
        view.root.position.set(node.position.x, 0, node.position.z);
        view.root.computeWorldMatrix(true);
        view.collider.computeWorldMatrix(true);
      }
      if (node.health === node.maxHealth) view.hitTime = 0;
    }
  }
}
