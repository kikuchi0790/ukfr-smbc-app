import * as THREE from 'three';
import { BuildingConfig, BuildingElement } from '../3d-building-factory';

export function getEiffelTowerConfig(): BuildingConfig {
  const towerHeight = 30;
  const firstPlatformHeight = towerHeight * 0.2;
  const secondPlatformHeight = towerHeight * 0.5;
  const topPlatformHeight = towerHeight * 0.9;
  const legRadiusStart = 4;
  const legRadiusEnd = 0.5;

  return {
    type: 'tower',
    buildingColor: '#4A4A4A',
    accentColor: '#FFA500',
    levels: [
      // Level 0: Basic Structural Outline (0%)
      {
        visibilityThreshold: 0,
        elements: [
          // Legs
          ...Array.from({ length: 4 }, (_, i) => {
            const angle = (Math.PI / 2) * i + Math.PI / 4;
            const legSections = 5;
            const elements: BuildingElement[] = [];

            // Leg sections
            for (let j = 0; j < legSections; j++) {
              const sectionHeight = firstPlatformHeight / legSections;
              const currentY = j * sectionHeight;
              const nextY = (j + 1) * sectionHeight;
              const currentRadius = legRadiusStart - (legRadiusStart - 1.5) * (j / legSections);
              const nextRadius = legRadiusStart - (legRadiusStart - 1.5) * ((j + 1) / legSections);

              // Main leg line
              const points = [
                new THREE.Vector3(currentRadius, currentY, 0),
                new THREE.Vector3(nextRadius, nextY, 0)
              ];
              const geom = new THREE.BufferGeometry().setFromPoints(points);
              
              elements.push({
                type: 'custom',
                geometry: geom,
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: angle, z: 0 },
                material: 'line',
                color: 0xffffff,
                opacity: 0.3
              });

              // Outer guide line
              const outerPoints = [
                new THREE.Vector3(currentRadius + 0.5, currentY, 0),
                new THREE.Vector3(nextRadius + 0.5, nextY, 0)
              ];
              const outerGeom = new THREE.BufferGeometry().setFromPoints(outerPoints);
              
              elements.push({
                type: 'custom',
                geometry: outerGeom,
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: angle, z: 0 },
                material: 'line',
                color: 0xffffff,
                opacity: 0.3
              });
            }

            // Upper leg section
            const upperLegPoints = [
              new THREE.Vector3(1.5, firstPlatformHeight, 0),
              new THREE.Vector3(legRadiusEnd * 1.5, secondPlatformHeight, 0),
              new THREE.Vector3(legRadiusEnd, topPlatformHeight, 0),
              new THREE.Vector3(legRadiusEnd * 0.8, towerHeight, 0)
            ];
            const upperLegGeom = new THREE.BufferGeometry().setFromPoints(upperLegPoints);
            
            elements.push({
              type: 'custom',
              geometry: upperLegGeom,
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: angle, z: 0 },
              material: 'line',
              color: 0xffffff,
              opacity: 0.3
            });

            return elements;
          }).flat(),
          // Platform outlines
          {
            type: 'box',
            position: { x: 0, y: firstPlatformHeight, z: 0 },
            scale: { x: 8, y: 0.5, z: 8 },
            material: 'line',
            color: 0xffffff,
            opacity: 0.3
          },
          {
            type: 'box',
            position: { x: 0, y: secondPlatformHeight, z: 0 },
            scale: { x: 4, y: 0.5, z: 4 },
            material: 'line',
            color: 0xffffff,
            opacity: 0.3
          },
          {
            type: 'box',
            position: { x: 0, y: topPlatformHeight, z: 0 },
            scale: { x: 2, y: 0.5, z: 2 },
            material: 'line',
            color: 0xffffff,
            opacity: 0.3
          }
        ]
      },
      // Level 1: Platforms Details & Base Arches (20%)
      {
        visibilityThreshold: 20,
        elements: [
          // Platform details
          {
            type: 'box',
            position: { x: 0, y: firstPlatformHeight, z: 0 },
            scale: { x: 8.2, y: 0.7, z: 8.2 },
            material: 'line',
            opacity: 0
          },
          // Base arches
          ...Array.from({ length: 4 }, (_, i) => {
            const angle = (Math.PI / 2) * i;
            const curve = new THREE.CatmullRomCurve3([
              new THREE.Vector3(-legRadiusStart * 0.6, 0, 0),
              new THREE.Vector3(-legRadiusStart * 0.3, firstPlatformHeight * 0.6, 0),
              new THREE.Vector3(0, firstPlatformHeight * 0.8, 0),
              new THREE.Vector3(legRadiusStart * 0.3, firstPlatformHeight * 0.6, 0),
              new THREE.Vector3(legRadiusStart * 0.6, 0, 0),
            ]);
            const points = curve.getPoints(20);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            
            return {
              type: 'custom',
              geometry,
              position: {
                x: Math.cos(angle) * legRadiusStart * 0.7,
                y: 0,
                z: Math.sin(angle) * legRadiusStart * 0.7
              },
              rotation: { x: 0, y: angle - Math.PI / 2, z: 0 },
              material: 'line',
              opacity: 0
            } as BuildingElement;
          })
        ]
      },
      // Level 2: Primary Lattice Work (40%)
      {
        visibilityThreshold: 40,
        elements: [
          // Leg lattice
          ...Array.from({ length: 4 }, (_, i) => {
            const angle = (Math.PI / 2) * i + Math.PI / 4;
            const elements: BuildingElement[] = [];

            // Lower section lattice
            for (let h = 0; h < firstPlatformHeight; h += 2) {
              const currentLegRadius = legRadiusStart - (legRadiusStart - 1.5) * (h / firstPlatformHeight);
              const p1 = new THREE.Vector3(
                Math.cos(angle) * currentLegRadius,
                h,
                Math.sin(angle) * currentLegRadius
              );
              const p2 = new THREE.Vector3(
                Math.cos(angle + Math.PI/2) * currentLegRadius,
                h + 1,
                Math.sin(angle + Math.PI/2) * currentLegRadius
              );
              const crossGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
              
              elements.push({
                type: 'custom',
                geometry: crossGeom,
                position: { x: 0, y: 0, z: 0 },
                material: 'line',
                opacity: 0
              });
            }

            // Upper section lattice
            for (let h = firstPlatformHeight; h < secondPlatformHeight; h += 1.5) {
              const t = (h - firstPlatformHeight) / (secondPlatformHeight - firstPlatformHeight);
              const currentPillarRadius = 1.5 * (1 - t) + legRadiusEnd * 1.5 * t;
              const p1 = new THREE.Vector3(
                Math.cos(angle) * currentPillarRadius,
                h,
                Math.sin(angle) * currentPillarRadius
              );
              const p2 = new THREE.Vector3(
                Math.cos(angle + Math.PI/2) * currentPillarRadius,
                h + 0.75,
                Math.sin(angle + Math.PI/2) * currentPillarRadius
              );
              const crossGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
              
              elements.push({
                type: 'custom',
                geometry: crossGeom,
                position: { x: 0, y: 0, z: 0 },
                material: 'line',
                opacity: 0
              });
            }

            return elements;
          }).flat()
        ]
      },
      // Level 3: Secondary Lattice & Platform Railings (60%)
      {
        visibilityThreshold: 60,
        elements: [
          // Platform railings
          ...[[8, firstPlatformHeight], [4, secondPlatformHeight], [2, topPlatformHeight]].map(([size, platformY]) => {
            const railingHeight = 0.5;
            const railPoints = [
              new THREE.Vector3(-size/2, railingHeight, size/2),
              new THREE.Vector3(size/2, railingHeight, size/2),
              new THREE.Vector3(size/2, railingHeight, -size/2),
              new THREE.Vector3(-size/2, railingHeight, -size/2),
              new THREE.Vector3(-size/2, railingHeight, size/2)
            ];
            const railGeom = new THREE.BufferGeometry().setFromPoints(railPoints);
            
            return {
              type: 'custom',
              geometry: railGeom,
              position: { x: 0, y: platformY as number, z: 0 },
              material: 'line',
              useAccentColor: true,
              opacity: 0
            } as BuildingElement;
          }),
          // Fine lattice on upper sections
          ...Array.from({ length: 30 }, (_, i) => {
            const h = secondPlatformHeight + (towerHeight - secondPlatformHeight) * (i / 30);
            const t = (h - secondPlatformHeight) / (towerHeight - secondPlatformHeight);
            const currentRadius = legRadiusEnd * 1.5 * (1 - t) + legRadiusEnd * 0.8 * t;
            const elements: BuildingElement[] = [];

            for (let j = 0; j < 8; j++) {
              const angleSeg = (Math.PI * 2 / 8) * j;
              const p1 = new THREE.Vector3(
                Math.cos(angleSeg) * currentRadius,
                h,
                Math.sin(angleSeg) * currentRadius
              );
              const p2 = new THREE.Vector3(
                Math.cos(angleSeg + Math.PI/8) * (currentRadius * 0.95),
                h + 0.5,
                Math.sin(angleSeg + Math.PI/8) * (currentRadius * 0.95)
              );
              const fineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
              
              elements.push({
                type: 'custom',
                geometry: fineGeom,
                position: { x: 0, y: 0, z: 0 },
                material: 'line',
                useAccentColor: true,
                opacity: 0
              });
            }

            return elements;
          }).flat()
        ]
      },
      // Level 4: Antenna & Lighting Accents (80%)
      {
        visibilityThreshold: 80,
        elements: [
          // Antenna base
          {
            type: 'cylinder',
            position: { x: 0, y: towerHeight + 1, z: 0 },
            scale: { x: 0.3, y: 0.2, z: 2 },
            material: 'mesh',
            opacity: 0
          },
          // Antenna spire
          {
            type: 'cone',
            position: { x: 0, y: towerHeight + 3, z: 0 },
            scale: { x: 0.2, y: 3, z: 0.2 },
            material: 'mesh',
            opacity: 0
          },
          // Lighting "sparkles"
          ...Array.from({ length: 30 }, (_) => {
            const y = Math.random() * towerHeight;
            let radius: number;
            
            if (y < firstPlatformHeight) {
              radius = legRadiusStart * (1 - (y / firstPlatformHeight) * 0.7);
            } else if (y < secondPlatformHeight) {
              radius = 1.5 * (1 - (y - firstPlatformHeight)/(secondPlatformHeight - firstPlatformHeight) * 0.6) + 1;
            } else {
              radius = legRadiusEnd * (1 - (y - secondPlatformHeight)/(towerHeight - secondPlatformHeight) * 0.5) + 0.5;
            }
            
            const angle = Math.random() * Math.PI * 2;
            
            return {
              type: 'sphere',
              position: {
                x: Math.cos(angle) * radius,
                y: y,
                z: Math.sin(angle) * radius
              },
              scale: { x: 0.1, y: 0.1, z: 0.1 },
              material: 'mesh',
              useAccentColor: true,
              opacity: 0
            } as BuildingElement;
          })
        ]
      }
    ]
  };
}