
import * as THREE from 'three';

// Building configurations
const BUILDING_CONFIGS: Record<string, { buildingColor: number; accentColor: number; detailColor?: number }> = {
  bigben: {
    buildingColor: 0xD4A76A,
    accentColor: 0x8B7355
  },
  eiffel: {
    buildingColor: 0x4A4A4A,
    accentColor: 0xFFD700
  },
  colosseum: {
    buildingColor: 0xF4E4C1,
    accentColor: 0xB8956A
  },
  sagrada: {
    buildingColor: 0xE8D7C3,
    accentColor: 0xFF6B6B,
    detailColor: 0x4ECDC4
  },
  windmill: {
    buildingColor: 0x8B4513,
    accentColor: 0xFFF8DC
  },
  brandenburg: {
    buildingColor: 0xDDD5C7,
    accentColor: 0xB8860B
  }
};

// Helper to get building config by ID
const getBuildingConfig = (id: string) => BUILDING_CONFIGS[id];

// --- Helper function to create line segments from geometry ---
function createEdges(geometry: THREE.BufferGeometry, material: THREE.LineBasicMaterialParameters): THREE.LineSegments {
    const edges = new THREE.EdgesGeometry(geometry);
    return new THREE.LineSegments(edges, new THREE.LineBasicMaterial(material));
}

// --- Helper function to create a mesh with basic material ---
function createMesh(geometry: THREE.BufferGeometry, material: THREE.MeshBasicMaterialParameters): THREE.Mesh {
    return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial(material));
}


export function createBigBen_three(): THREE.Group {
    const group = new THREE.Group();
    const buildingConfig = getBuildingConfig('bigben');
    if (!buildingConfig) return group;

    const buildingColor = new THREE.Color(buildingConfig.buildingColor as THREE.ColorRepresentation);
    const accentColor = new THREE.Color(buildingConfig.accentColor as THREE.ColorRepresentation);
    
    // Level 0: Basic structure (white lines)
    const level0 = new THREE.Group();
    
    const baseGeometry = new THREE.BoxGeometry(6, 2, 6);
    const baseLines = createEdges(baseGeometry, { color: 0xffffff, transparent: true, opacity: 0.3 });
    baseLines.position.y = 1;
    level0.add(baseLines);
    
    const towerGeometry = new THREE.CylinderGeometry(2.5, 3, 20, 8);
    const towerLines = createEdges(towerGeometry, { color: 0xffffff, transparent: true, opacity: 0.3 });
    towerLines.position.y = 12;
    level0.add(towerLines);
    
    const clockGeometry = new THREE.BoxGeometry(6, 4, 6);
    const clockLines = createEdges(clockGeometry, { color: 0xffffff, transparent: true, opacity: 0.3 });
    clockLines.position.y = 20;
    level0.add(clockLines);
    
    const belfryGeometry = new THREE.CylinderGeometry(2, 2.5, 4, 8);
    const belfryLines = createEdges(belfryGeometry, { color: 0xffffff, transparent: true, opacity: 0.3 });
    belfryLines.position.y = 24;
    level0.add(belfryLines);
    
    const spireGeometry = new THREE.ConeGeometry(1.5, 8, 8);
    const spireLines = createEdges(spireGeometry, { color: 0xffffff, transparent: true, opacity: 0.3 });
    spireLines.position.y = 30;
    level0.add(spireLines);
    
    group.add(level0);
    group.userData.level0 = level0;
    
    // Level 1: Clock faces and numbers (20%)
    const level1 = new THREE.Group();
    for (let side = 0; side < 4; side++) {
        const angle = (Math.PI / 2) * side;
        const clockGroup = new THREE.Group();
        
        const clockFaceGeometry = new THREE.CircleGeometry(2.5, 32);
        const clockFaceLines = createEdges(clockFaceGeometry, { color: buildingColor, transparent: true, opacity: 0 });
        clockGroup.add(clockFaceLines);
        
        const innerCircleGeometry = new THREE.CircleGeometry(2, 24);
        const innerCircleLines = createEdges(innerCircleGeometry, { color: buildingColor, transparent: true, opacity: 0 });
        clockGroup.add(innerCircleLines);
        
        for (let hour = 0; hour < 12; hour++) {
            const hourAngle = (hour / 12) * Math.PI * 2 - Math.PI / 2;
            const markerGeometry = new THREE.BoxGeometry(0.1, 0.4, 0.1);
            const markerMesh = createMesh(markerGeometry, { color: accentColor, transparent: true, opacity: 0 });
            markerMesh.position.x = Math.cos(hourAngle) * 2.2;
            markerMesh.position.y = Math.sin(hourAngle) * 2.2;
            markerMesh.position.z = 0.1; // slight offset
            clockGroup.add(markerMesh);
        }
        
        clockGroup.position.y = 20;
        clockGroup.position.x = Math.cos(angle) * 3.01; // Adjust for box thickness
        clockGroup.position.z = Math.sin(angle) * 3.01; // Adjust for box thickness
        clockGroup.rotation.y = angle;
        if(side === 0) clockGroup.rotation.x = 0; // Front face
        else if (side === 1) clockGroup.rotation.y = Math.PI / 2; // Right face
        else if (side === 2) { clockGroup.rotation.x = 0; clockGroup.position.z *= -1; clockGroup.position.x *= -1; } // Back face (needs adjustment)
        else if (side === 3) clockGroup.rotation.y = -Math.PI / 2; // Left face
        
        // Make clock faces look at the center from outside the box
        const tempVec = new THREE.Vector3(0, 20, 0); // center of clock box
        clockGroup.lookAt(tempVec);


        level1.add(clockGroup);
    }
    level1.visible = false;
    group.add(level1);
    group.userData.level1 = level1;
    
    // Level 2: Gothic windows and decoration (40%)
    const level2 = new THREE.Group();
    for (let i = 0; i < 4; i++) { // 4 sides of the tower
        for (let j = 0; j < 6; j++) { // 6 windows per side
            const angle = (Math.PI / 2) * i;
            const windowGroup = new THREE.Group();
            const archCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.3, 0, 0), new THREE.Vector3(-0.3, 0.8, 0),
                new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(0.3, 0.8, 0),
                new THREE.Vector3(0.3, 0, 0)
            ]);
            const archPoints = archCurve.getPoints(20);
            const archGeometry = new THREE.BufferGeometry().setFromPoints(archPoints);
            const archLine = new THREE.Line(archGeometry, new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0 }));
            windowGroup.add(archLine);
            
            const gridGeometry = new THREE.PlaneGeometry(0.5, 1);
            const gridMesh = createMesh(gridGeometry, { color: accentColor, transparent: true, opacity: 0, wireframe: true });
            windowGroup.add(gridMesh);
            
            windowGroup.position.x = Math.cos(angle) * 2.8; // Position on the face of the tower
            windowGroup.position.z = Math.sin(angle) * 2.8;
            windowGroup.position.y = 3 + j * 2.5;
            windowGroup.lookAt(0, windowGroup.position.y, 0); // Orient towards the center
            level2.add(windowGroup);
        }
    }
    for (let level = 0; level < 3; level++) { // Decorative cornices
        const corniceRadius = 3 - level * 0.3;
        const corniceGeometry = new THREE.TorusGeometry(corniceRadius, 0.2, 4, 16); // Simplified segments
        const corniceLines = createEdges(corniceGeometry, { color: buildingColor, transparent: true, opacity: 0 });
        corniceLines.position.y = 8 + level * 8;
        corniceLines.rotation.x = Math.PI / 2;
        level2.add(corniceLines);
    }
    level2.visible = false;
    group.add(level2);
    group.userData.level2 = level2;

    // Level 3: Moving clock hands and bell (60%)
    const level3 = new THREE.Group();
    for (let side = 0; side < 4; side++) {
        const angle = (Math.PI / 2) * side;
        const handsGroup = new THREE.Group();
        handsGroup.name = `clockHands${side}`;
        
        const hourHandGeometry = new THREE.BoxGeometry(0.3, 1.8, 0.15);
        hourHandGeometry.translate(0, 0.9, 0); // Pivot at base
        const hourHandMesh = createMesh(hourHandGeometry, { color: 0x000000, transparent: true, opacity: 0 });
        hourHandMesh.name = 'hourHand';
        handsGroup.add(hourHandMesh);
        
        const minuteHandGeometry = new THREE.BoxGeometry(0.2, 2.2, 0.15);
        minuteHandGeometry.translate(0, 1.1, 0); // Pivot at base
        const minuteHandMesh = createMesh(minuteHandGeometry, { color: 0x000000, transparent: true, opacity: 0 });
        minuteHandMesh.name = 'minuteHand';
        minuteHandMesh.rotation.z = Math.PI / 3; // Initial position
        handsGroup.add(minuteHandMesh);
        
        const centerGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const centerMesh = createMesh(centerGeometry, { color: accentColor, transparent: true, opacity: 0 });
        handsGroup.add(centerMesh);
        
        handsGroup.position.y = 20; // Align with clock face center
        // Position on the surface of the clock box
        const radius = 3.02; // Slightly outside the clock box face
        handsGroup.position.x = Math.cos(angle) * radius;
        handsGroup.position.z = Math.sin(angle) * radius;
        handsGroup.lookAt(new THREE.Vector3(0,20,0)); // Make hands face outwards correctly

        level3.add(handsGroup);
    }
    const bellGeometry = new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.8); // Open bottom
    const bellMesh = createMesh(bellGeometry, { color: accentColor, transparent: true, opacity: 0, wireframe: true });
    bellMesh.position.y = 24; // Inside belfry
    bellMesh.name = 'bigBell';
    level3.add(bellMesh);
    level3.visible = false;
    group.add(level3);
    group.userData.level3 = level3;

    // Level 4: Ornate decorative details (80%)
    const level4 = new THREE.Group();
    for (let i = 0; i < 8; i++) { // Pinnacles around belfry
        const pinnacleGroup = new THREE.Group();
        const angle = (Math.PI * 2 / 8) * i;
        
        const pinnacleGeometry = new THREE.ConeGeometry(0.4, 2, 6);
        const pinnacleMesh = createMesh(pinnacleGeometry, { color: buildingColor, transparent: true, opacity: 0 });
        pinnacleGroup.add(pinnacleMesh);
        
        const orbGeometry = new THREE.SphereGeometry(0.2, 6, 6);
        const orbMesh = createMesh(orbGeometry, { color: accentColor, transparent: true, opacity: 0 });
        orbMesh.position.y = 1.2; // Top of pinnacle cone
        pinnacleGroup.add(orbMesh);
        
        pinnacleGroup.position.x = Math.cos(angle) * 3.5; // Around the main tower below spire
        pinnacleGroup.position.z = Math.sin(angle) * 3.5;
        pinnacleGroup.position.y = 23; // Height adjust
        level4.add(pinnacleGroup);
    }
    const crownGeometry = new THREE.TorusGeometry(1, 0.3, 6, 8);
    const crownMesh = createMesh(crownGeometry, { color: accentColor, transparent: true, opacity: 0, wireframe: true });
    crownMesh.position.y = 34; // Top of spire
    crownMesh.rotation.x = Math.PI / 2;
    level4.add(crownMesh);
    
    const flagPoleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2);
    const flagPoleMesh = createMesh(flagPoleGeometry, { color: buildingColor, transparent: true, opacity: 0 });
    flagPoleMesh.position.y = 35; // Top of crown
    level4.add(flagPoleMesh);
    level4.visible = false;
    group.add(level4);
    group.userData.level4 = level4;
    
    return group;
}

export function createEiffelTower_three(): THREE.Group {
    const group = new THREE.Group();
    const buildingConfig = getBuildingConfig('eiffel');
    if (!buildingConfig) return group;

    const buildingColor = new THREE.Color(buildingConfig.buildingColor as THREE.ColorRepresentation);
    const accentColor = new THREE.Color(buildingConfig.accentColor as THREE.ColorRepresentation);
    const whiteLines = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });

    const towerHeight = 30;
    const firstPlatformHeight = towerHeight * 0.2;
    const secondPlatformHeight = towerHeight * 0.5;
    const topPlatformHeight = towerHeight * 0.9;

    // --- Level 0: Basic Structural Outline ---
    const level0 = new THREE.Group();

    // Legs (more realistic curve)
    const legSections = 5;
    const legRadiusStart = 4;
    const legRadiusEnd = 0.5;

    for (let i = 0; i < 4; i++) { // 4 legs
        const angle = (Math.PI / 2) * i + Math.PI / 4; // Rotated for wider base
        const leg = new THREE.Group();
        let currentY = 0;
        let currentRadius = legRadiusStart;

        for (let j = 0; j < legSections; j++) {
            const sectionHeight = firstPlatformHeight / legSections;
            const nextRadius = legRadiusStart - (legRadiusStart - 1.5) * ((j + 1) / legSections);
            
            const points = [
                new THREE.Vector3(currentRadius, currentY, 0),
                new THREE.Vector3(nextRadius, currentY + sectionHeight, 0)
            ];
            const geom = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geom, whiteLines);
            leg.add(line);

            // Outer curve guide
            const pointsOuter = [
                 new THREE.Vector3(currentRadius + 0.5, currentY, 0),
                 new THREE.Vector3(nextRadius + 0.5, currentY + sectionHeight, 0)
            ];
            const geomOuter = new THREE.BufferGeometry().setFromPoints(pointsOuter);
            const lineOuter = new THREE.Line(geomOuter, whiteLines);
            leg.add(lineOuter);


            currentY += sectionHeight;
            currentRadius = nextRadius;
        }
        // Connect legs towards center above first platform
        const upperLegPoints = [
            new THREE.Vector3(currentRadius, firstPlatformHeight, 0),
            new THREE.Vector3(legRadiusEnd * 1.5, secondPlatformHeight, 0),
            new THREE.Vector3(legRadiusEnd, topPlatformHeight, 0),
            new THREE.Vector3(legRadiusEnd * 0.8, towerHeight, 0)
        ];
        const upperLegGeom = new THREE.BufferGeometry().setFromPoints(upperLegPoints);
        const upperLegLine = new THREE.Line(upperLegGeom, whiteLines);
        leg.add(upperLegLine);

        leg.rotation.y = angle;
        level0.add(leg);
    }
    
    // Basic Platform Outlines
    const platformMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const p1Geom = new THREE.BoxGeometry(8, 0.5, 8);
    const p1Edges = createEdges(p1Geom, { color: 0xffffff, transparent: true, opacity: 0.3 });
    p1Edges.position.y = firstPlatformHeight;
    level0.add(p1Edges);

    const p2Geom = new THREE.BoxGeometry(4, 0.5, 4);
    const p2Edges = createEdges(p2Geom, { color: 0xffffff, transparent: true, opacity: 0.3 });
    p2Edges.position.y = secondPlatformHeight;
    level0.add(p2Edges);

    const p3Geom = new THREE.BoxGeometry(2, 0.5, 2);
    const p3Edges = createEdges(p3Geom, { color: 0xffffff, transparent: true, opacity: 0.3 });
    p3Edges.position.y = topPlatformHeight;
    level0.add(p3Edges);

    group.add(level0);
    group.userData.level0 = level0;

    // --- Level 1: Platforms Details & Base Arches (20%) ---
    const level1 = new THREE.Group();
    const platformDetailMat = new THREE.LineBasicMaterial({ color: buildingColor, transparent: true, opacity: 0 });

    // First platform details
    const p1DetailGeom = new THREE.BoxGeometry(8.2, 0.7, 8.2);
    const p1DetailEdges = createEdges(p1DetailGeom, { color: buildingColor, transparent: true, opacity: 0 });
    p1DetailEdges.position.y = firstPlatformHeight;
    level1.add(p1DetailEdges);

    // Base Arches
    for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i;
        const arch = new THREE.Group();
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-legRadiusStart * 0.6, 0, 0),
            new THREE.Vector3(-legRadiusStart * 0.3, firstPlatformHeight * 0.6, 0),
            new THREE.Vector3(0, firstPlatformHeight * 0.8, 0),
            new THREE.Vector3(legRadiusStart * 0.3, firstPlatformHeight * 0.6, 0),
            new THREE.Vector3(legRadiusStart * 0.6, 0, 0),
        ]);
        const points = curve.getPoints(20);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, platformDetailMat);
        arch.add(line);
        arch.position.set(Math.cos(angle) * legRadiusStart * 0.7, 0, Math.sin(angle) * legRadiusStart * 0.7);
        arch.lookAt(0, firstPlatformHeight * 0.5, 0);
        level1.add(arch);
    }
    level1.visible = false;
    group.add(level1);
    group.userData.level1 = level1;


    // --- Level 2: Primary Lattice Work (40%) ---
    const level2 = new THREE.Group();
    const latticeMat = new THREE.LineBasicMaterial({ color: buildingColor, transparent: true, opacity: 0 });

    // Legs lattice
    for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i + Math.PI / 4;
        for (let h = 0; h < firstPlatformHeight; h += 2) {
            const currentLegRadius = legRadiusStart - (legRadiusStart - 1.5) * (h / firstPlatformHeight);
            const p1 = new THREE.Vector3(Math.cos(angle) * currentLegRadius, h, Math.sin(angle) * currentLegRadius);
            const p2 = new THREE.Vector3(Math.cos(angle + Math.PI/2) * currentLegRadius, h + 1, Math.sin(angle+Math.PI/2) * currentLegRadius);
            const crossGeom = new THREE.BufferGeometry().setFromPoints([p1,p2]);
            const crossLine = new THREE.Line(crossGeom, latticeMat);
            level2.add(crossLine);
        }
         // Lattice between first and second platform
        for (let h = firstPlatformHeight; h < secondPlatformHeight; h += 1.5) {
            const t = (h - firstPlatformHeight) / (secondPlatformHeight - firstPlatformHeight);
            const currentPillarRadius = (1.5) * (1-t) + legRadiusEnd * 1.5 * t; // Interpolate radius
            const p1 = new THREE.Vector3(Math.cos(angle) * currentPillarRadius, h, Math.sin(angle) * currentPillarRadius);
            const p2 = new THREE.Vector3(Math.cos(angle + Math.PI/2) * currentPillarRadius, h + 0.75, Math.sin(angle+Math.PI/2) * currentPillarRadius);
            const crossGeom = new THREE.BufferGeometry().setFromPoints([p1,p2]);
            const crossLine = new THREE.Line(crossGeom, latticeMat);
            level2.add(crossLine);
        }
    }
    level2.visible = false;
    group.add(level2);
    group.userData.level2 = level2;

    // --- Level 3: Secondary Lattice & Platform Railings (60%) ---
    const level3 = new THREE.Group();
    const fineLatticeMat = new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0 });

    // Railings for platforms
    const railingHeight = 0.5;
    [[8, firstPlatformHeight], [4, secondPlatformHeight], [2, topPlatformHeight]].forEach(([size, platformY]) => {
        for(let k=0; k<4; k++){
            const railPoints = [
                new THREE.Vector3(size/2, platformY + railingHeight, size/2 * (k===0 || k===3 ? 1 : -1)),
                new THREE.Vector3(size/2 * (k<2 ? 1 : -1), platformY + railingHeight, size/2 * (k===0 || k===1 ? 1 : -1))
            ];
             const railGeom = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-size/2, railingHeight, size/2), new THREE.Vector3(size/2, railingHeight, size/2),
                new THREE.Vector3(size/2, railingHeight, -size/2), new THREE.Vector3(-size/2, railingHeight, -size/2),
                new THREE.Vector3(-size/2, railingHeight, size/2) // close loop
            ]);
            const railLine = new THREE.Line(railGeom, fineLatticeMat);
            railLine.position.y = platformY;
            level3.add(railLine);
        }
    });
    
    // More intricate lattice on upper sections
    for (let h = secondPlatformHeight; h < towerHeight; h += 1) {
         const t = (h - secondPlatformHeight) / (towerHeight - secondPlatformHeight);
         const currentRadius = legRadiusEnd * 1.5 * (1-t) + legRadiusEnd * 0.8 * t; 
        for (let j = 0; j < 8; j++) { // More divisions for finer look
            const angleSeg = (Math.PI * 2 / 8) * j;
            const p1 = new THREE.Vector3(Math.cos(angleSeg) * currentRadius, h, Math.sin(angleSeg) * currentRadius);
            const p2 = new THREE.Vector3(Math.cos(angleSeg + Math.PI/8) * (currentRadius*0.95), h + 0.5, Math.sin(angleSeg + Math.PI/8) * (currentRadius*0.95));
            const fineGeom = new THREE.BufferGeometry().setFromPoints([p1,p2]);
            const fineLine = new THREE.Line(fineGeom, fineLatticeMat);
            level3.add(fineLine);
        }
    }
    level3.visible = false;
    group.add(level3);
    group.userData.level3 = level3;

    // --- Level 4: Antenna & Lighting Accents (80%) ---
    const level4 = new THREE.Group();
    const lightMat = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0 });

    // Antenna
    const antennaBaseGeom = new THREE.CylinderGeometry(0.3, 0.2, 2, 6);
    const antennaBaseMesh = createMesh(antennaBaseGeom, {color: buildingColor, transparent: true, opacity: 0});
    antennaBaseMesh.position.y = towerHeight + 1;
    level4.add(antennaBaseMesh);

    const antennaSpireGeom = new THREE.ConeGeometry(0.2, 3, 6);
    const antennaSpireMesh = createMesh(antennaSpireGeom, {color: buildingColor, transparent: true, opacity: 0});
    antennaSpireMesh.position.y = towerHeight + 1 + 2; // Base height + half spire height
    level4.add(antennaSpireMesh);

    // Lighting "sparkles"
    for (let i = 0; i < 30; i++) {
        const lightGeom = new THREE.SphereGeometry(0.1, 4, 4);
        const lightMesh = createMesh(lightGeom, {color: accentColor, transparent: true, opacity: 0});
        const y = Math.random() * towerHeight;
        const t = y / towerHeight; // 0 at base, 1 at top
        
        // Determine radius based on height (approximate tower shape)
        let radius;
        if (y < firstPlatformHeight) {
            radius = legRadiusStart * (1 - (y / firstPlatformHeight) * 0.7); // Tapering on legs
        } else if (y < secondPlatformHeight) {
            radius = 1.5 * (1 - (y - firstPlatformHeight)/(secondPlatformHeight - firstPlatformHeight) * 0.6) + 1;
        } else {
            radius = legRadiusEnd * (1 - (y - secondPlatformHeight)/(towerHeight - secondPlatformHeight) * 0.5) + 0.5;
        }
        
        const angle = Math.random() * Math.PI * 2;
        lightMesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        level4.add(lightMesh);
    }
    level4.visible = false;
    group.add(level4);
    group.userData.level4 = level4;

    return group;
}


export function createColosseum_three(): THREE.Group {
    const group = new THREE.Group();
    const buildingConfig = getBuildingConfig('colosseum');
    if (!buildingConfig) return group;
    const buildingColor = new THREE.Color(buildingConfig.buildingColor as THREE.ColorRepresentation);
    const accentColor = new THREE.Color(buildingConfig.accentColor as THREE.ColorRepresentation);

    const outerRadius = 8;
    const height = 12; // Total height
    const levels = 3;
    const levelHeight = height / levels;
    const segments = 32; // For outer ellipse shape

    // Level 0: Basic Structure
    const level0 = new THREE.Group();
    for (let l = 0; l < levels; l++) {
        const y = l * levelHeight;
        const outerPoints = [];
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            outerPoints.push(new THREE.Vector3(Math.cos(angle) * outerRadius * 1.2, 0, Math.sin(angle) * outerRadius));
        }
        const wallGeometry = new THREE.BufferGeometry().setFromPoints(outerPoints);
        const wallLine = new THREE.Line(wallGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 }));
        wallLine.position.y = y;
        level0.add(wallLine);
    }
    group.add(level0);
    group.userData.level0 = level0;
    
    // Level 1: Arches
    const level1 = new THREE.Group();
    const archMaterial = new THREE.LineBasicMaterial({color: buildingColor, transparent:true, opacity: 0});
    for (let l = 0; l < levels; l++) {
        const y = l * levelHeight;
        for (let i = 0; i < 16; i++) { // Arches per level
            const angle = (i / 16) * Math.PI * 2;
            const archGroup = new THREE.Group();
            const archCurve = new THREE.CatmullRomCurve3([
                new THREE.Vector3(-0.5, 0, 0), new THREE.Vector3(-0.5, 1, 0),
                new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0.5, 1, 0),
                new THREE.Vector3(0.5, 0, 0)
            ]);
            const archPoints = archCurve.getPoints(10);
            const archGeometry = new THREE.BufferGeometry().setFromPoints(archPoints);
            const archLine = new THREE.Line(archGeometry, archMaterial);
            archGroup.add(archLine);
            archGroup.position.set(Math.cos(angle) * outerRadius * 1.1, y + levelHeight*0.1, Math.sin(angle) * outerRadius * 0.9);
            archGroup.lookAt(0, y + levelHeight*0.1, 0);
            archGroup.scale.set(1.5, levelHeight*0.5, 1); // Scale arches to fit level height
            level1.add(archGroup);
        }
    }
    level1.visible = false;
    group.add(level1);
    group.userData.level1 = level1;

    // Level 2: Inner structures and details
    const level2 = new THREE.Group();
    const innerRadius = outerRadius * 0.6;
    const innerMaterial = new THREE.LineBasicMaterial({color: accentColor, transparent: true, opacity: 0});
    for (let l = 0; l < levels -1; l++) { // Inner walls don't go to top typically
        const y = l * levelHeight;
        const innerPoints = [];
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            innerPoints.push(new THREE.Vector3(Math.cos(angle) * innerRadius * 1.2, 0, Math.sin(angle) * innerRadius));
        }
        const innerWallGeom = new THREE.BufferGeometry().setFromPoints(innerPoints);
        const innerWallLine = new THREE.Line(innerWallGeom, innerMaterial);
        innerWallLine.position.y = y;
        level2.add(innerWallLine);
    }
    level2.visible = false;
    group.add(level2);
    group.userData.level2 = level2;

    // Level 3 & 4 could be for finer details, rubble, arena floor etc.
    // For simplicity, these are left sparse for Colosseum
    group.userData.level3 = new THREE.Group(); group.userData.level3.visible = false; group.add(group.userData.level3);
    group.userData.level4 = new THREE.Group(); group.userData.level4.visible = false; group.add(group.userData.level4);


    return group;
}

export function createSagradaFamilia_three(): THREE.Group {
    const group = new THREE.Group();
    const buildingConfig = getBuildingConfig('sagrada');
    if (!buildingConfig) return group;
    const buildingColor = new THREE.Color(buildingConfig.buildingColor as THREE.ColorRepresentation);
    const accentColor = new THREE.Color(buildingConfig.accentColor as THREE.ColorRepresentation);
    const detailColor = buildingConfig.detailColor ? new THREE.Color(buildingConfig.detailColor as THREE.ColorRepresentation) : accentColor;

    const towerPositions = [
        { x: 0, z: 0, height: 25, radius: 1.5 }, { x: -3, z: 0, height: 20, radius: 1.2 },
        { x: 3, z: 0, height: 20, radius: 1.2 }, { x: -1.5, z: -3, height: 18, radius: 1 },
        { x: 1.5, z: -3, height: 18, radius: 1 }
    ];
    
    // Level 0: Basic tower outlines
    const level0 = new THREE.Group();
    towerPositions.forEach(pos => {
        const towerGeometry = new THREE.CylinderGeometry(pos.radius * 0.3, pos.radius, pos.height, 8);
        const towerLines = createEdges(towerGeometry, { color: 0xffffff, transparent: true, opacity: 0.3 });
        towerLines.position.set(pos.x, pos.height / 2, pos.z);
        level0.add(towerLines);
    });
    group.add(level0);
    group.userData.level0 = level0;

    // Level 1: Spiral details and tower tops
    const level1 = new THREE.Group();
    const spiralMat = new THREE.LineBasicMaterial({color: buildingColor, transparent:true, opacity:0});
    towerPositions.forEach(pos => {
        const spiralPoints = [];
        for (let i = 0; i <= 50; i++) {
            const t = i / 50; const angle = t * Math.PI * 6; const y = t * pos.height;
            const r = pos.radius * (1 - t * 0.7);
            spiralPoints.push(new THREE.Vector3(Math.cos(angle) * r + pos.x, y, Math.sin(angle) * r + pos.z));
        }
        const spiralGeometry = new THREE.BufferGeometry().setFromPoints(spiralPoints);
        const spiralLine = new THREE.Line(spiralGeometry, spiralMat);
        level1.add(spiralLine);

        const topGeometry = new THREE.ConeGeometry(pos.radius * 0.5, 3, 4);
        const topLines = createEdges(topGeometry, { color: buildingColor, transparent: true, opacity: 0 });
        topLines.position.set(pos.x, pos.height + 1.5, pos.z);
        level1.add(topLines);
    });
    level1.visible = false;
    group.add(level1);
    group.userData.level1 = level1;

    // Level 2: Facade and connecting structures
    const level2 = new THREE.Group();
    const facadeMat = new THREE.LineBasicMaterial({color: accentColor, transparent:true, opacity:0});
    const facadeWidth = 8; const facadeHeight = 15;
    const facadePoints = [
        new THREE.Vector3(-facadeWidth/2, 0, 3), new THREE.Vector3(-facadeWidth/2, facadeHeight, 3),
        new THREE.Vector3(0, facadeHeight + 5, 3), new THREE.Vector3(facadeWidth/2, facadeHeight, 3),
        new THREE.Vector3(facadeWidth/2, 0, 3)
    ];
    const facadeGeometry = new THREE.BufferGeometry().setFromPoints(facadePoints);
    const facadeLine = new THREE.Line(facadeGeometry, facadeMat);
    level2.add(facadeLine);
    level2.visible = false;
    group.add(level2);
    group.userData.level2 = level2;

    // Level 3 & 4: Stained glass effect / finer details
    const level3 = new THREE.Group();
    // Add some "stained glass" planes
    towerPositions.forEach(pos => {
        for(let k=0; k<3; k++){
            const planeGeom = new THREE.PlaneGeometry(pos.radius*0.5, pos.radius*0.5);
            const planeMat = new THREE.MeshBasicMaterial({
                color: k % 2 === 0 ? accentColor : detailColor, 
                transparent:true, 
                opacity:0, 
                side: THREE.DoubleSide
            });
            const planeMesh = new THREE.Mesh(planeGeom, planeMat);
            planeMesh.position.set(pos.x + (Math.random()-0.5)*pos.radius, pos.height * (0.2 + Math.random()*0.6), pos.z + (Math.random()-0.5)*pos.radius);
            planeMesh.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
            level3.add(planeMesh);
        }
    });
    level3.visible = false; group.add(level3); group.userData.level3 = level3;
    group.userData.level4 = new THREE.Group(); group.userData.level4.visible = false; group.add(group.userData.level4);


    return group;
}

export function createWindmill_three(): THREE.Group {
    const group = new THREE.Group();
    const buildingConfig = getBuildingConfig('windmill');
    if (!buildingConfig) return group;
    const buildingColor = new THREE.Color(buildingConfig.buildingColor as THREE.ColorRepresentation);
    const accentColor = new THREE.Color(buildingConfig.accentColor as THREE.ColorRepresentation); // White for blades

    // Level 0: Basic structure
    const level0 = new THREE.Group();
    const bodyGeometry = new THREE.CylinderGeometry(3, 4, 12, 8); // baseRadius, topRadius, height, segments
    const bodyLines = createEdges(bodyGeometry, { color: 0xffffff, transparent: true, opacity: 0.3 });
    bodyLines.position.y = 6; // Center of cylinder at y=6
    level0.add(bodyLines);

    const roofGeometry = new THREE.ConeGeometry(3.5, 4, 8); // radius, height, segments
    const roofLines = createEdges(roofGeometry, { color: 0xffffff, transparent: true, opacity: 0.3 });
    roofLines.position.y = 12 + 2; // Positioned on top of the body
    level0.add(roofLines);
    group.add(level0);
    group.userData.level0 = level0;

    // Blades are part of base structure but colored by accentColor when revealed
    const bladeGroup = new THREE.Group();
    bladeGroup.name = 'blades'; // For animation
    const bladeMaterial = new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0 }); // Start transparent
    for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i;
        const bladeFramePoints = [ // Rectangular frame for each blade
            new THREE.Vector3(0.2, 0, 0), new THREE.Vector3(6, 1, 0),
            new THREE.Vector3(6, -1, 0), new THREE.Vector3(0.2, 0, 0),
        ];
        const bladeFrameGeom = new THREE.BufferGeometry().setFromPoints(bladeFramePoints);
        const bladeFrameLine = new THREE.Line(bladeFrameGeom, bladeMaterial);
        bladeFrameLine.rotation.z = angle;
        bladeGroup.add(bladeFrameLine);
    }
    bladeGroup.position.y = 10; // Attachment point on the body
    bladeGroup.position.z = 3.5; // Protrude from body
    group.add(bladeGroup);
    // Note: blades will become visible via opacity change in main app logic, tied to level1 progress

    // Level 1: Blade格子 (Lattice on blades) & making blades opaque
    const level1 = new THREE.Group(); 
    // This group can be empty if blades are handled directly by progress, or add finer details here.
    // For now, level1 progress will make bladeGroup material opaque.
    for (let i = 0; i < 4; i++) { // For each blade
        const angle = (Math.PI / 2) * i;
        for (let j = 1; j < 5; j++) { // Cross struts
            const xPos = j * 1.2; // along the blade length
            const strutPoints = [ new THREE.Vector3(xPos, 0.8, 0), new THREE.Vector3(xPos, -0.8, 0) ];
            const strutGeom = new THREE.BufferGeometry().setFromPoints(strutPoints);
            const strutLine = new THREE.Line(strutGeom, new THREE.LineBasicMaterial({color: accentColor, transparent:true, opacity:0}));
            strutLine.rotation.z = angle;
            level1.add(strutLine);
        }
    }
    level1.position.copy(bladeGroup.position); // Match blade group's position
    level1.visible = false; group.add(level1); group.userData.level1 = level1;


    // Level 2: Windows and door
    const level2 = new THREE.Group();
    const featureMat = new THREE.MeshBasicMaterial({color: buildingColor, transparent: true, opacity: 0, wireframe: true});
    
    const windowGeometry = new THREE.PlaneGeometry(1.5,2);
    const windowMesh = new THREE.Mesh(windowGeometry, featureMat.clone());
    windowMesh.position.set(0, 6, 4.01); // Slightly in front of cylinder face
    level2.add(windowMesh);
    
    const doorGeometry = new THREE.PlaneGeometry(2,3);
    const doorMesh = new THREE.Mesh(doorGeometry, featureMat.clone());
    doorMesh.position.set(0, 1.5, 4.01); // Ground level
    level2.add(doorMesh);
    level2.visible = false; group.add(level2); group.userData.level2 = level2;

    // Level 3: Brick/texture indication lines
    const level3 = new THREE.Group();
    const brickLineMat = new THREE.LineBasicMaterial({color: buildingColor, transparent: true, opacity: 0});
    for (let y = 0; y < 12; y+=1) { // Horizontal lines around cylinder
        const ringGeom = new THREE.TorusGeometry(3 + (y/12), 0.05, 4, 8); // radius, tube, radialSegments, tubularSegments
        const ringLine = createEdges(ringGeom, {color:buildingColor, transparent:true, opacity:0});
        ringLine.rotation.x = Math.PI/2;
        ringLine.position.y = y;
        level3.add(ringLine);
    }
    level3.visible = false; group.add(level3); group.userData.level3 = level3;
    group.userData.level4 = new THREE.Group(); group.userData.level4.visible = false; group.add(group.userData.level4);


    return group;
}

export function createBrandenburgGate_three(): THREE.Group {
    const group = new THREE.Group();
    const buildingConfig = getBuildingConfig('brandenburg');
    if (!buildingConfig) return group;
    const buildingColor = new THREE.Color(buildingConfig.buildingColor as THREE.ColorRepresentation);
    const accentColor = new THREE.Color(buildingConfig.accentColor as THREE.ColorRepresentation);

    const columnHeight = 12;
    const columnRadius = 0.6;
    const entablatureHeight = 2;
    const entablatureWidth = 14;
    const entablatureDepth = 3;

    // Level 0: Basic column and entablature outlines
    const level0 = new THREE.Group();
    const columnPositionsX = [-5, -2.5, 0, 2.5, 5]; // Simplified 5 sets of columns for wireframe clarity
                                                  // Real one has 6 columns, 5 passageways.
                                                  // This creates 4 passageways visually between 5 columns.

    columnPositionsX.forEach(x => {
        const columnGeometry = new THREE.CylinderGeometry(columnRadius, columnRadius, columnHeight, 8);
        const columnLines = createEdges(columnGeometry, { color: 0xffffff, transparent: true, opacity: 0.3 });
        columnLines.position.set(x, columnHeight / 2, 0);
        level0.add(columnLines);
    });

    const topGeometry = new THREE.BoxGeometry(entablatureWidth, entablatureHeight, entablatureDepth);
    const topLines = createEdges(topGeometry, { color: 0xffffff, transparent: true, opacity: 0.3 });
    topLines.position.y = columnHeight + entablatureHeight / 2;
    level0.add(topLines);
    group.add(level0);
    group.userData.level0 = level0;

    // Level 1: Column capitals and base details
    const level1 = new THREE.Group();
    const capitalDetailMat = new THREE.LineBasicMaterial({color: buildingColor, transparent:true, opacity:0});
    columnPositionsX.forEach(x => {
        const capitalGeom = new THREE.BoxGeometry(columnRadius*2, columnRadius, columnRadius*2);
        const capitalEdges = createEdges(capitalGeom, {color:buildingColor, transparent: true, opacity:0});
        capitalEdges.position.set(x, columnHeight - columnRadius/2, 0); // Top of column
        level1.add(capitalEdges);

        const baseGeom = new THREE.CylinderGeometry(columnRadius*1.2, columnRadius*1.2, 0.5, 8);
        const baseEdges = createEdges(baseGeom, {color:buildingColor, transparent: true, opacity:0});
        baseEdges.position.set(x, 0.25, 0); // Base of column
        level1.add(baseEdges);
    });
    level1.visible = false;
    group.add(level1);
    group.userData.level1 = level1;
    
    // Level 2: Entablature details (triglyphs, metopes - simplified)
    const level2 = new THREE.Group();
    const entabDetailMat = new THREE.LineBasicMaterial({color:buildingColor, transparent:true, opacity:0});
    for(let i=0; i < 10; i++) {
        const detailWidth = entablatureWidth / 10;
        const triglyphGeom = new THREE.BoxGeometry(detailWidth*0.4, entablatureHeight*0.8, entablatureDepth*0.5);
        const triglyphEdges = createEdges(triglyphGeom, {color:buildingColor, transparent:true, opacity:0});
        triglyphEdges.position.set(-entablatureWidth/2 + i*detailWidth + detailWidth*0.2, columnHeight + entablatureHeight/2, entablatureDepth/2);
        level2.add(triglyphEdges);
    }
    level2.visible = false;
    group.add(level2);
    group.userData.level2 = level2;

    // Level 3: Quadriga (simplified chariot and horses)
    const level3 = new THREE.Group();
    const quadrigaMat = new THREE.LineBasicMaterial({color:accentColor, transparent:true, opacity:0});
    const chariotGeom = new THREE.BoxGeometry(2,1,1.5);
    const chariotEdges = createEdges(chariotGeom, {color:accentColor, transparent:true, opacity:0});
    chariotEdges.position.y = columnHeight + entablatureHeight + 0.5;
    level3.add(chariotEdges);

    for(let i=-1; i<=1; i+=2){ // Two horses simplified
        const horseGeom = new THREE.BoxGeometry(0.8,1.5,2.5);
        const horseEdges = createEdges(horseGeom, {color:accentColor, transparent:true, opacity:0});
        horseEdges.position.set(i*1.2, columnHeight+entablatureHeight+0.75, -1);
        level3.add(horseEdges);
    }
    level3.visible = false;
    group.add(level3);
    group.userData.level3 = level3;
    
    // Level 4: Victory statue in Quadriga (very simplified)
    const level4 = new THREE.Group();
    const statueGeom = new THREE.CylinderGeometry(0.2,0.2,1.5,6);
    const statueMesh = createMesh(statueGeom, {color:accentColor, transparent:true, opacity:0});
    statueMesh.position.set(0, columnHeight+entablatureHeight+1.5, 0); // On chariot
    level4.add(statueMesh);
    level4.visible = false;
    group.add(level4);
    group.userData.level4 = level4;

    return group;
}
