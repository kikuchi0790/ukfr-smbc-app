import * as THREE from 'three';

// ビルディングのタイプ定義
export type BuildingType = 'tower' | 'monument' | 'gate' | 'windmill';

// ビルディング要素の定義
export interface BuildingElement {
  type: 'box' | 'cylinder' | 'cone' | 'sphere' | 'torus' | 'plane' | 'custom';
  geometry?: THREE.BufferGeometry;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  material?: 'line' | 'mesh';
  color?: number | string;
  opacity?: number;
  wireframe?: boolean;
  useAccentColor?: boolean; // accentColorを使用するかどうか
}

// レベル設定の定義
export interface LevelConfig {
  visibilityThreshold: number; // 0-100%での表示閾値
  elements: BuildingElement[];
  animations?: AnimationConfig[];
}

// アニメーション設定
export interface AnimationConfig {
  targetName: string;
  type: 'rotation' | 'position' | 'scale';
  axis: 'x' | 'y' | 'z';
  speed: number;
}

// ビルディング設定
export interface BuildingConfig {
  type: BuildingType;
  buildingColor: number | string;
  accentColor: number | string;
  levels: LevelConfig[];
}

// エッジ作成のヘルパー関数
export function createEdges(
  geometry: THREE.BufferGeometry,
  materialOptions: { color: number | string; transparent?: boolean; opacity?: number }
): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial(materialOptions);
  return new THREE.LineSegments(edges, material);
}

// メッシュ作成のヘルパー関数
export function createMesh(
  geometry: THREE.BufferGeometry,
  materialOptions: { color: number | string; transparent?: boolean; opacity?: number; wireframe?: boolean }
): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial(materialOptions);
  return new THREE.Mesh(geometry, material);
}

// 3Dビルディングファクトリークラス
export class Building3DFactory {
  private static createGeometry(element: BuildingElement): THREE.BufferGeometry | null {
    switch (element.type) {
      case 'box':
        return new THREE.BoxGeometry(
          element.scale?.x || 1,
          element.scale?.y || 1,
          element.scale?.z || 1
        );
      case 'cylinder':
        return new THREE.CylinderGeometry(
          element.scale?.x || 1,
          element.scale?.y || 1,
          element.scale?.z || 2,
          8
        );
      case 'cone':
        return new THREE.ConeGeometry(
          element.scale?.x || 1,
          element.scale?.y || 2,
          8
        );
      case 'sphere':
        return new THREE.SphereGeometry(
          element.scale?.x || 1,
          8,
          8
        );
      case 'torus':
        return new THREE.TorusGeometry(
          element.scale?.x || 1,
          element.scale?.y || 0.3,
          4,
          16
        );
      case 'plane':
        return new THREE.PlaneGeometry(
          element.scale?.x || 1,
          element.scale?.y || 1
        );
      case 'custom':
        return element.geometry || null;
      default:
        return null;
    }
  }

  private static createElement(element: BuildingElement, defaultColor: number | string): THREE.Object3D | null {
    const geometry = this.createGeometry(element);
    if (!geometry) return null;

    let object: THREE.Object3D;
    const color = element.color || defaultColor;

    if (element.material === 'mesh') {
      object = createMesh(geometry, {
        color,
        transparent: element.opacity !== undefined,
        opacity: element.opacity || 1,
        wireframe: element.wireframe || false
      });
    } else {
      object = createEdges(geometry, {
        color,
        transparent: element.opacity !== undefined,
        opacity: element.opacity || 1
      });
    }

    // 位置設定
    object.position.set(element.position.x, element.position.y, element.position.z);

    // 回転設定
    if (element.rotation) {
      object.rotation.set(element.rotation.x, element.rotation.y, element.rotation.z);
    }

    return object;
  }

  private static createLevel(
    levelConfig: LevelConfig,
    buildingColor: number | string,
    accentColor: number | string
  ): THREE.Group {
    const levelGroup = new THREE.Group();

    levelConfig.elements.forEach(element => {
      const defaultColor = element.useAccentColor ? accentColor : buildingColor;
      const object = this.createElement(element, defaultColor);
      if (object) {
        levelGroup.add(object);
      }
    });

    // 初期状態では非表示（Level 0以外）
    if (levelConfig.visibilityThreshold > 0) {
      levelGroup.visible = false;
    }

    return levelGroup;
  }

  static create(config: BuildingConfig): THREE.Group {
    const group = new THREE.Group();
    const buildingColor = new THREE.Color(config.buildingColor as THREE.ColorRepresentation);
    const accentColor = new THREE.Color(config.accentColor as THREE.ColorRepresentation);

    // 各レベルを作成
    config.levels.forEach((levelConfig, index) => {
      const level = this.createLevel(levelConfig, buildingColor.getHex(), accentColor.getHex());
      group.add(level);
      group.userData[`level${index}`] = level;
    });

    return group;
  }

  // レベルの表示制御
  static updateVisibility(building: THREE.Group, progress: number): void {
    const levels = Object.keys(building.userData)
      .filter(key => key.startsWith('level'))
      .map(key => building.userData[key]);

    levels.forEach((level, index) => {
      const threshold = index * 20; // 0%, 20%, 40%, 60%, 80%
      level.visible = progress >= threshold;

      // 表示されているレベルのオパシティ調整
      if (level.visible) {
        level.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
            const material = child.material as THREE.Material;
            if ('opacity' in material) {
              material.opacity = Math.min(1, (progress - threshold) / 20);
            }
          }
        });
      }
    });
  }

  // アニメーション適用
  static applyAnimations(building: THREE.Group, config: BuildingConfig, time: number): void {
    config.levels.forEach((levelConfig, levelIndex) => {
      const level = building.userData[`level${levelIndex}`];
      if (!level || !level.visible || !levelConfig.animations) return;

      levelConfig.animations.forEach(animation => {
        const target = level.getObjectByName(animation.targetName);
        if (!target) return;

        switch (animation.type) {
          case 'rotation':
            target.rotation[animation.axis] = time * animation.speed;
            break;
          case 'position':
            const basePos = target.userData.basePosition || target.position[animation.axis];
            target.position[animation.axis] = basePos + Math.sin(time * animation.speed) * 0.5;
            break;
          case 'scale':
            const baseScale = target.userData.baseScale || 1;
            target.scale[animation.axis] = baseScale + Math.sin(time * animation.speed) * 0.1;
            break;
        }
      });
    });
  }
}

// ビルディング設定を取得する関数
export function getBuildingConfig(name: string): { buildingColor: string; accentColor: string; detailColor?: string } | null {
  const configs: Record<string, { buildingColor: string; accentColor: string; detailColor?: string }> = {
    bigben: { buildingColor: '#8B7355', accentColor: '#FFD700' },
    eiffel: { buildingColor: '#4A4A4A', accentColor: '#FFA500' },
    colosseum: { buildingColor: '#D2691E', accentColor: '#8B4513' },
    sagrada: { buildingColor: '#DEB887', accentColor: '#FF6347', detailColor: '#4ECDC4' },
    windmill: { buildingColor: '#8B4513', accentColor: '#FF6347' },
    brandenburg: { buildingColor: '#A0522D', accentColor: '#FFD700' }
  };
  return configs[name] || null;
}