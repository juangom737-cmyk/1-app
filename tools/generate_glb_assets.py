#!/usr/bin/env python3
"""Build the original, self-contained Bogotá game GLB assets (stdlib only)."""

from __future__ import annotations

import json
import math
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "models"


class MeshData:
    def __init__(self) -> None:
        self.parts: dict[str, dict[str, list]] = {}

    def _part(self, material: str) -> dict[str, list]:
        if material not in self.parts:
            self.parts[material] = {"positions": [], "normals": [], "indices": []}
        return self.parts[material]

    def face(self, material: str, points: list[tuple[float, float, float]], normal: tuple[float, float, float]) -> None:
        part = self._part(material)
        base = len(part["positions"]) // 3
        for point in points:
            part["positions"].extend(point)
            part["normals"].extend(normal)
        if len(points) == 3:
            part["indices"].extend((base, base + 1, base + 2))
        else:
            part["indices"].extend((base, base + 1, base + 2, base, base + 2, base + 3))

    def box(self, material: str, center: tuple[float, float, float], size: tuple[float, float, float]) -> None:
        x, y, z = center
        sx, sy, sz = (v / 2 for v in size)
        faces = [
            ([(x-sx,y-sy,z-sz),(x+sx,y-sy,z-sz),(x+sx,y+sy,z-sz),(x-sx,y+sy,z-sz)], (0,0,-1)),
            ([(x+sx,y-sy,z+sz),(x-sx,y-sy,z+sz),(x-sx,y+sy,z+sz),(x+sx,y+sy,z+sz)], (0,0,1)),
            ([(x-sx,y-sy,z+sz),(x-sx,y-sy,z-sz),(x-sx,y+sy,z-sz),(x-sx,y+sy,z+sz)], (-1,0,0)),
            ([(x+sx,y-sy,z-sz),(x+sx,y-sy,z+sz),(x+sx,y+sy,z+sz),(x+sx,y+sy,z-sz)], (1,0,0)),
            ([(x-sx,y+sy,z-sz),(x+sx,y+sy,z-sz),(x+sx,y+sy,z+sz),(x-sx,y+sy,z+sz)], (0,1,0)),
            ([(x-sx,y-sy,z+sz),(x+sx,y-sy,z+sz),(x+sx,y-sy,z-sz),(x-sx,y-sy,z-sz)], (0,-1,0)),
        ]
        for points, normal in faces:
            self.face(material, points, normal)

    def sphere(self, material: str, center: tuple[float, float, float], radii: tuple[float, float, float], segments: int = 16, rings: int = 10) -> None:
        part = self._part(material)
        base = len(part["positions"]) // 3
        cx, cy, cz = center
        rx, ry, rz = radii
        for row in range(rings + 1):
            phi = math.pi * row / rings
            for col in range(segments + 1):
                theta = math.tau * col / segments
                nx = math.sin(phi) * math.cos(theta)
                ny = math.cos(phi)
                nz = math.sin(phi) * math.sin(theta)
                part["positions"].extend((cx + nx*rx, cy + ny*ry, cz + nz*rz))
                part["normals"].extend((nx/rx, ny/ry, nz/rz))
        for row in range(rings):
            for col in range(segments):
                a = base + row * (segments + 1) + col
                b = a + segments + 1
                part["indices"].extend((a, b, a+1, b, b+1, a+1))

    def cylinder(self, material: str, center: tuple[float, float, float], radius: float, height: float, segments: int = 16) -> None:
        part = self._part(material)
        base = len(part["positions"]) // 3
        cx, cy, cz = center
        for y in (cy - height/2, cy + height/2):
            for i in range(segments + 1):
                angle = math.tau * i / segments
                nx, nz = math.cos(angle), math.sin(angle)
                part["positions"].extend((cx + nx*radius, y, cz + nz*radius))
                part["normals"].extend((nx, 0, nz))
        for i in range(segments):
            a = base + i
            b = base + segments + 1 + i
            part["indices"].extend((a, a+1, b, a+1, b+1, b))


MATERIALS = {
    "hero_blue": ([0.035, 0.16, 0.38, 1], 0.10, 0.34),
    "hero_blue_dark": ([0.018, 0.07, 0.17, 1], 0.08, 0.45),
    "hero_red": ([0.62, 0.035, 0.055, 1], 0.05, 0.4),
    "hero_red_dark": ([0.28, 0.018, 0.03, 1], 0.08, 0.42),
    "hero_gold": ([0.86, 0.52, 0.08, 1], 0.72, 0.24),
    "skin": ([0.48, 0.27, 0.18, 1], 0.0, 0.62),
    "hair": ([0.025, 0.018, 0.015, 1], 0.04, 0.36),
    "eye_white": ([0.9, 0.9, 0.82, 1], 0.0, 0.28),
    "eye_blue": ([0.025, 0.2, 0.42, 1], 0.08, 0.2),
    "brick_red": ([0.43, 0.15, 0.095, 1], 0.0, 0.9),
    "brick_dark": ([0.27, 0.08, 0.055, 1], 0.0, 0.92),
    "stucco_cream": ([0.72, 0.62, 0.47, 1], 0.0, 0.92),
    "stucco_yellow": ([0.74, 0.49, 0.22, 1], 0.0, 0.9),
    "stucco_coral": ([0.62, 0.22, 0.15, 1], 0.0, 0.9),
    "stucco_blue": ([0.22, 0.35, 0.39, 1], 0.0, 0.9),
    "concrete": ([0.43, 0.44, 0.42, 1], 0.0, 0.88),
    "dark_glass": ([0.025, 0.075, 0.12, 1], 0.45, 0.18),
    "window_warm": ([0.58, 0.39, 0.19, 1], 0.08, 0.36),
    "roof_tile": ([0.33, 0.095, 0.055, 1], 0.0, 0.82),
    "shop_teal": ([0.035, 0.22, 0.23, 1], 0.04, 0.38),
    "shop_green": ([0.08, 0.23, 0.13, 1], 0.0, 0.72),
    "asphalt": ([0.105, 0.12, 0.13, 1], 0.0, 0.96),
    "sidewalk": ([0.42, 0.42, 0.38, 1], 0.0, 0.92),
    "grass": ([0.08, 0.18, 0.095, 1], 0.0, 0.96),
    "glass_blue": ([0.065, 0.2, 0.29, 1], 0.52, 0.16),
    "tower_frame": ([0.34, 0.38, 0.39, 1], 0.62, 0.35),
}


class Gltf:
    def __init__(self, asset_name: str) -> None:
        self.asset_name = asset_name
        self.bin = bytearray()
        self.views: list[dict] = []
        self.accessors: list[dict] = []
        self.materials: list[dict] = []
        self.material_index: dict[str, int] = {}
        self.meshes: list[dict] = []
        self.nodes: list[dict] = []
        self.animations: list[dict] = []
        self.scene_roots: list[int] = []
        for name, (color, metal, rough) in MATERIALS.items():
            self.material_index[name] = len(self.materials)
            self.materials.append({
                "name": name,
                "pbrMetallicRoughness": {
                    "baseColorFactor": color,
                    "metallicFactor": metal,
                    "roughnessFactor": rough,
                },
                "doubleSided": name.startswith("hero_red"),
            })

    def _append(self, values: list[float | int], fmt: str) -> tuple[int, int]:
        while len(self.bin) % 4:
            self.bin.append(0)
        offset = len(self.bin)
        self.bin.extend(struct.pack("<" + fmt * len(values), *values))
        return offset, len(self.bin) - offset

    def accessor(self, values: list[float | int], fmt: str, component: int, count: int, kind: str, target: int | None = None, bounds: bool = False) -> int:
        offset, length = self._append(values, fmt)
        view = {"buffer": 0, "byteOffset": offset, "byteLength": length}
        if target:
            view["target"] = target
        self.views.append(view)
        accessor = {"bufferView": len(self.views)-1, "componentType": component, "count": count, "type": kind}
        if bounds and kind == "VEC3":
            triples = list(zip(values[0::3], values[1::3], values[2::3]))
            accessor["min"] = [min(v[i] for v in triples) for i in range(3)]
            accessor["max"] = [max(v[i] for v in triples) for i in range(3)]
        self.accessors.append(accessor)
        return len(self.accessors) - 1

    def add_mesh(self, name: str, geometry: MeshData) -> int:
        primitives = []
        for material, part in geometry.parts.items():
            if not part["indices"]:
                continue
            positions = self.accessor(part["positions"], "f", 5126, len(part["positions"])//3, "VEC3", 34962, True)
            normalized_normals = []
            for i in range(0, len(part["normals"]), 3):
                nx, ny, nz = part["normals"][i:i+3]
                length = math.sqrt(nx*nx + ny*ny + nz*nz) or 1.0
                normalized_normals.extend((nx/length, ny/length, nz/length))
            normals = self.accessor(normalized_normals, "f", 5126, len(normalized_normals)//3, "VEC3", 34962)
            if len(part["positions"])//3 < 65536:
                indices = self.accessor(part["indices"], "H", 5123, len(part["indices"]), "SCALAR", 34963)
            else:
                indices = self.accessor(part["indices"], "I", 5125, len(part["indices"]), "SCALAR", 34963)
            primitives.append({
                "attributes": {"POSITION": positions, "NORMAL": normals},
                "indices": indices,
                "material": self.material_index[material],
            })
        self.meshes.append({"name": name, "primitives": primitives})
        return len(self.meshes) - 1

    def add_node(self, name: str, mesh: int | None = None, translation: tuple[float, float, float] | None = None, scale: tuple[float, float, float] | None = None, rotation: tuple[float, float, float, float] | None = None, parent: int | None = None) -> int:
        node = {"name": name}
        if mesh is not None:
            node["mesh"] = mesh
        if translation is not None:
            node["translation"] = list(translation)
        if scale is not None:
            node["scale"] = list(scale)
        if rotation is not None:
            node["rotation"] = list(rotation)
        self.nodes.append(node)
        index = len(self.nodes) - 1
        if parent is None:
            self.scene_roots.append(index)
        else:
            self.nodes[parent].setdefault("children", []).append(index)
        return index

    def add_animation(self, name: str, tracks: list[tuple[int, str, list[float], list[float], int]]) -> None:
        samplers, channels = [], []
        for node, path, times, values, components in tracks:
            input_accessor = self.accessor(times, "f", 5126, len(times), "SCALAR", bounds=True)
            output_accessor = self.accessor(values, "f", 5126, len(values)//components, "VEC4" if components == 4 else "VEC3")
            samplers.append({"input": input_accessor, "output": output_accessor, "interpolation": "LINEAR"})
            channels.append({"sampler": len(samplers)-1, "target": {"node": node, "path": path}})
        self.animations.append({"name": name, "samplers": samplers, "channels": channels})

    def write(self, path: Path) -> None:
        gltf = {
            "asset": {"version": "2.0", "generator": "Bogotá Guardian Asset Builder"},
            "scene": 0,
            "scenes": [{"name": self.asset_name, "nodes": self.scene_roots}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "buffers": [{"byteLength": len(self.bin)}],
            "bufferViews": self.views,
            "accessors": self.accessors,
        }
        if self.animations:
            gltf["animations"] = self.animations
        json_chunk = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
        json_chunk += b" " * ((4 - len(json_chunk) % 4) % 4)
        bin_chunk = bytes(self.bin) + b"\0" * ((4 - len(self.bin) % 4) % 4)
        total = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as output:
            output.write(struct.pack("<III", 0x46546C67, 2, total))
            output.write(struct.pack("<II", len(json_chunk), 0x4E4F534A))
            output.write(json_chunk)
            output.write(struct.pack("<II", len(bin_chunk), 0x004E4942))
            output.write(bin_chunk)


def mesh_node(gltf: Gltf, name: str, material_shapes: dict[str, list[callable]], translation=(0, 0, 0), parent=None) -> int:
    geometry = MeshData()
    for material, shapes in material_shapes.items():
        for shape in shapes:
            shape(geometry, material)
    mesh = gltf.add_mesh(name + "Mesh", geometry)
    return gltf.add_node(name, mesh, translation=translation, parent=parent)


def build_hero(path: Path) -> None:
    gltf = Gltf("Bogotá Guardian — animated hero")

    def ellipsoid(material: str, center, radii, segments=22, rings=14):
        return lambda g, m: g.sphere(m, center, radii, segments, rings)
    def box(material: str, center, size):
        return lambda g, m: g.box(m, center, size)

    torso = MeshData()
    # Athletic torso taper, built as smooth rings.
    rings = [(-0.78,0.37,0.22),(-0.48,0.43,0.24),(-0.12,0.50,0.26),(0.25,0.62,0.29),(0.56,0.69,0.30),(0.77,0.48,0.24)]
    seg = 28
    base = 0
    for y, rx, rz in rings:
        for i in range(seg + 1):
            angle = math.tau * i / seg
            x, z = math.cos(angle), math.sin(angle)
            torso.parts.setdefault("hero_blue", {"positions":[],"normals":[],"indices":[]})["positions"].extend((x*rx,y,z*rz))
            torso.parts["hero_blue"]["normals"].extend((x,0.08,z))
    p = torso.parts["hero_blue"]
    for row in range(len(rings)-1):
        for i in range(seg):
            a = base + row*(seg+1)+i
            b = a + seg + 1
            p["indices"].extend((a,a+1,b,a+1,b+1,b))
    torso_parts = {"hero_blue": [lambda g,m: g.parts.update(torso.parts)]}
    torso_parts["hero_blue"] += [ellipsoid("hero_blue",(-0.245,0.27,-0.075),(0.27,0.20,0.18)),ellipsoid("hero_blue",(0.245,0.27,-0.075),(0.27,0.20,0.18))]
    torso_parts["hero_blue_dark"] = [ellipsoid("hero_blue_dark",(-0.19,-0.16,-0.245),(0.10,0.14,0.018)),ellipsoid("hero_blue_dark",(0.19,-0.16,-0.245),(0.10,0.14,0.018))]
    torso_node = mesh_node(gltf,"torso",torso_parts,(0,3.65,0))

    # Gold-edged red pentagonal crest, layered on the chest facing -Z.
    shield = MeshData()
    def polygon(material, verts, depth=0.045):
        n = len(verts)
        top = [(x,y,-depth/2) for x,y in verts]
        bottom = [(x,y,depth/2) for x,y in verts]
        center_top = (sum(v[0] for v in top)/n,sum(v[1] for v in top)/n,-depth/2)
        for i in range(n):
            j=(i+1)%n
            shield.face(material,[center_top,top[i],top[j]],(0,0,-1))
            shield.face(material,[bottom[j],bottom[i],(center_top[0],center_top[1],depth/2)],(0,0,1))
            shield.face(material,[top[i],bottom[i],bottom[j],top[j]],(0,0,-1))
    polygon("hero_gold",[(-.36,.42),(.36,.42),(.30,.10),(0,-.30),(-.30,.10)])
    polygon("hero_red",[(-.27,.35),(.27,.35),(.22,.12),(0,-.19),(-.22,.12)],.06)
    # Geometric S glyph with three thick strokes and a diagonal spine.
    for c,center,size in [("hero_gold",(0,.235,-.06),(.36,.075,.035)),("hero_gold",(0,.065,-.06),(.30,.075,.035)),("hero_gold",(0,-.075,-.06),(.24,.075,.035)),("hero_gold",(0,.08,-.06),(.08,.36,.04))]:
        shield.box(c,center,size)
    shield_mesh=gltf.add_mesh("raised chest shield",shield)
    gltf.add_node("shield",shield_mesh,translation=(0,0.02,-0.315),parent=torso_node)

    pelvis_shapes={
        "hero_blue":[ellipsoid("hero_blue",(0,0,0),(.43,.34,.28))],
        "hero_red":[box("hero_red",(0,.13,-.01),(.84,.34,.58))],
        "hero_gold":[box("hero_gold",(0,.28,-.01),(.86,.11,.60)),box("hero_gold",(0,.28,-.32),(.16,.13,.03))],
    }
    pelvis=mesh_node(gltf,"pelvis",pelvis_shapes,(0,2.76,0))

    head_shapes={
        "skin":[ellipsoid("skin",(0,0,0),(.265,.355,.255)),ellipsoid("skin",(-.275,-.02,0),(.07,.11,.10)),ellipsoid("skin",(.275,-.02,0),(.07,.11,.10)),ellipsoid("skin",(0,-.13,-.22),(.15,.105,.085)),ellipsoid("skin",(0,.005,-.28),(.055,.09,.052))],
        "hair":[ellipsoid("hair",(0,.225,.005),(.27,.19,.26)),ellipsoid("hair",(-.14,.155,-.22),(.115,.095,.07)),ellipsoid("hair",(-.105,.132,-.245),(.072,.022,.025)),ellipsoid("hair",(.105,.132,-.245),(.072,.022,.025))],
        "eye_white":[ellipsoid("eye_white",(-.105,.055,-.226),(.062,.041,.026)),ellipsoid("eye_white",(.105,.055,-.226),(.062,.041,.026))],
        "eye_blue":[ellipsoid("eye_blue",(-.105,.055,-.25),(.027,.029,.014),14,8),ellipsoid("eye_blue",(.105,.055,-.25),(.027,.029,.014),14,8)],
    }
    head=mesh_node(gltf,"head",head_shapes,(0,1.29,0),torso_node)

    # Athletic arms with articulated shoulders, forearms and fists.
    arm_nodes={}
    for side,sign in (("left",-1),("right",1)):
        upper_shapes={
            "hero_blue":[ellipsoid("hero_blue",(0,-.36,0),(.205,.48,.21)),ellipsoid("hero_blue",(0,-.06,0),(.25,.23,.24))],
            "hero_blue_dark":[ellipsoid("hero_blue_dark",(0,-.43,-.14),(.11,.23,.075))],
        }
        shoulder=mesh_node(gltf,side+"UpperArm",upper_shapes,(sign*.66,.45,0),torso_node)
        arm_nodes[side]=shoulder
        forearm_shapes={
            "hero_blue":[ellipsoid("hero_blue",(0,-.34,0),(.165,.40,.18))],
            "hero_red":[box("hero_red",(0,-.67,0),(.34,.13,.36))],
            "skin":[ellipsoid("skin",(0,-.86,-.015),(.17,.17,.16))],
        }
        mesh_node(gltf,side+"Forearm",forearm_shapes,(0,-.67,0),shoulder)
        hand_shapes={"skin":[ellipsoid("skin",(0,-.04,0),(.15,.17,.14)),ellipsoid("skin",(-.13,-.18,-.01),(.045,.13,.045)),ellipsoid("skin",(-.045,-.20,-.01),(.04,.13,.04)),ellipsoid("skin",(.04,-.20,-.01),(.04,.13,.04)),ellipsoid("skin",(.12,-.17,-.01),(.04,.12,.04))]}
        mesh_node(gltf,side+"Hand",hand_shapes,(0,-.83,-.005),shoulder)

    # Legs, boots, soles and golden boot piping.
    leg_nodes={}
    for side,sign in (("left",-1),("right",1)):
        thigh_shapes={"hero_blue":[ellipsoid("hero_blue",(0,-.49,0),(.245,.61,.26)),ellipsoid("hero_blue",(sign*.03,-.19,-.03),(.24,.35,.25))]}
        hip=mesh_node(gltf,side+"Thigh",thigh_shapes,(sign*.235,-.10,0),pelvis)
        leg_nodes[side]=hip
        lower_shapes={"hero_blue":[ellipsoid("hero_blue",(0,-.39,0),(.175,.43,.18))],"hero_red":[ellipsoid("hero_red",(0,-.76,-.015),(.20,.34,.22)),box("hero_red",(0,-.56,0),(.40,.18,.38))],"hero_gold":[box("hero_gold",(0,-.59,-.205),(.38,.045,.035))]}
        shin=mesh_node(gltf,side+"Shin",lower_shapes,(0,-1.03,0),hip)
        boot_shapes={"hero_red":[ellipsoid("hero_red",(0,-.04,-.07),(.205,.20,.30))],"hero_red_dark":[box("hero_red_dark",(0,-.19,-.06),(.42,.11,.56))]}
        mesh_node(gltf,side+"Boot",boot_shapes,(0,-.78,-.055),shin)

    # Long, curved cape, triangulated as a cloth panel and attached between the shoulders.
    cape_geo=MeshData()
    part=cape_geo._part("hero_red")
    across, rows=14,24
    base=0
    for row in range(rows+1):
        t=row/rows
        y=-0.08-3.05*t
        width=.48+.31*t
        for col in range(across+1):
            u=col/across*2-1
            x=u*width
            z=.12 + .5*t + .12*math.sin(t*math.pi) + .055*math.sin(t*8.0+u*3.0)*t
            part["positions"].extend((x,y,z))
            part["normals"].extend((0,.08,1))
    for row in range(rows):
        for col in range(across):
            a=base+row*(across+1)+col
            b=a+across+1
            part["indices"].extend((a,a+1,b,a+1,b+1,b))
    cape_mesh=gltf.add_mesh("heavy crimson cape cloth",cape_geo)
    cape_node=gltf.add_node("cape",cape_mesh,translation=(0,.85,.18),parent=torso_node)

    # Animation channels target separate anatomical nodes; the game cross-fades these clips.
    def qx(angle: float) -> list[float]:
        return [math.sin(angle/2),0,0,math.cos(angle/2)]
    def track_rotation(node: int, angles: list[float]) -> tuple:
        return (node,"rotation",[0.0,0.5,1.0],[v for angle in angles for v in qx(angle)],4)
    idle=[]
    flight=[]
    run=[]
    landing=[]
    for side in ("left","right"):
        idle.append(track_rotation(arm_nodes[side],[0.04,0.0,0.04]))
        flight.append(track_rotation(arm_nodes[side],[1.12,1.18,1.12]))
        run.append(track_rotation(arm_nodes[side],[0.62 if side=="left" else -0.62,-0.62 if side=="left" else 0.62,0.62 if side=="left" else -0.62]))
        landing.append(track_rotation(arm_nodes[side],[-.20,-.48,-.20]))
        flight.append(track_rotation(leg_nodes[side],[0.06,0.1,0.06]))
        run.append(track_rotation(leg_nodes[side],[-.70,.70,-.70] if side=="left" else [.70,-.70,.70]))
        landing.append(track_rotation(leg_nodes[side],[.12,-.85,.12]))
    idle.append((cape_node,"rotation",[0.0,.5,1.0],[0,0,0,0.035,0,0,0,0,0],3))
    flight.append((cape_node,"rotation",[0.0,.5,1.0],[.13,0,0,.25,0,0,.13,0,0],3))
    run.append((cape_node,"rotation",[0.0,.5,1.0],[.04,0,.03,-.12,0,-.03,.04,0,.03],3))
    landing.append(track_rotation(torso_node,[0,.32,0]))
    landing.append((cape_node,"rotation",[0.0,.5,1.0],[.08,0,0,.30,0,0,.08,0,0],3))
    punch=[track_rotation(arm_nodes["right"],[0.0,1.35,0.12]),track_rotation(arm_nodes["left"],[0.02,-.2,0.02])]
    punch.append((cape_node,"rotation",[0.0,.5,1.0],[.03,0,0,.14,0,0,.03,0,0],3))
    gltf.add_animation("Idle",idle)
    gltf.add_animation("Flight",flight)
    gltf.add_animation("Run",run)
    gltf.add_animation("Punch",punch)
    gltf.add_animation("Landing",landing)
    gltf.write(path)


def add_window(geometry: MeshData, x: float, y: float, front_z: float, width: float, height: float) -> None:
    geometry.box("window_warm",(x,y,front_z-.025),(width+.16,height+.16,.09))
    geometry.box("dark_glass",(x,y,front_z-.078),(width,height,.035))
    geometry.box("concrete",(x,y-height/2-.05,front_z-.10),(width+.34,.09,.16))
    geometry.box("concrete",(x,y+height/2+.05,front_z-.10),(width+.34,.09,.16))
    geometry.box("window_warm",(x,y,front_z-.105),(.055,height,.055))


def add_colonial_house(geometry: MeshData, x: float, z: float, width: float, depth: float, height: float, wall: str) -> None:
    geometry.box(wall,(x,height/2,z),(width,height,depth))
    geometry.box("stucco_cream",(x,height*.48,z-depth/2-.035),(width+.12,.28,.12))
    floors=max(2,round(height/4.2))
    for floor in range(floors):
        y=2.1+floor*4.1
        if y+1.5>height-1:
            continue
        count=2 if width<20 else 3
        for k in range(count):
            wx=x+(k-(count-1)/2)*(width/(count+.3))
            add_window(geometry,wx,y,z-depth/2,width*.105,1.55 if floor else 1.85)
            if floor>0:
                geometry.box("window_warm",(wx,y-.72,z-depth/2-.38),(width*.15,.08,.75))
                geometry.box("window_warm",(wx,y-.46,z-depth/2-.70),(width*.15,.07,.05))
                for rail_x in (-.5,.5):
                    geometry.box("window_warm",(wx+rail_x*width*.15,y-.59,z-depth/2-.70),(.045,.30,.04))
        if floor>0:
            geometry.box("stucco_cream",(x,y-2.02,z-depth/2-.12),(width+.14,.15,.25))
    # Ground-floor shop, recessed doorway, and hand-painted fascia.
    geometry.box("dark_glass",(x-width*.26,1.15,z-depth/2-.10),(width*.31,2.25,.08))
    geometry.box("window_warm",(x-width*.26,1.15,z-depth/2-.16),(width*.34,2.38,.06))
    geometry.box("shop_teal",(x,3.0,z-depth/2-.14),(width*.98,.48,.18))
    geometry.box("concrete",(x,3.32,z-depth/2-.20),(width*1.04,.10,.28))
    # Flat colonial roof with parapet, cistern and a small clay-tile canopy.
    geometry.box("roof_tile",(x,height+.12,z),(width+.75,.34,depth+.7))
    geometry.box(wall,(x,height+.86,z-depth/2),(width+.55,1.5,.46))
    geometry.box(wall,(x,height+.86,z+depth/2),(width+.55,1.5,.46))
    geometry.box(wall,(x-width/2,height+.86,z),(0.46,1.5,depth+.6))
    geometry.box(wall,(x+width/2,height+.86,z),(0.46,1.5,depth+.6))
    geometry.cylinder("concrete",(x+width*.28,height+1.6,z+depth*.19),1.1,1.8,12)


def build_block_geometry(style: str) -> MeshData:
    geometry=MeshData()
    geometry.box("grass",(0,-.24,0),(88,.48,88))
    geometry.box("sidewalk",(0,.04,0),(84,.16,84))
    if style=="bogota-la-candelaria-block":
        walls=["stucco_cream","stucco_yellow","stucco_coral","stucco_blue","stucco_cream","stucco_yellow"]
        coords=[(-24,-23,19,19,14),(0,-23,19,19,17),(24,-23,19,19,15),(-24,23,19,19,16),(0,23,19,19,14),(24,23,19,19,18)]
        for wall,(x,z,w,d,h) in zip(walls,coords):
            add_colonial_house(geometry,x,z,w,d,h,wall)
    elif style=="bogota-brick-midrise-block":
        coords=[(-22,-22,37,37,29),(22,-22,37,37,39),(-22,22,37,37,34),(22,22,37,37,26)]
        for idx,(x,z,w,d,h) in enumerate(coords):
            geometry.box("brick_red" if idx%2==0 else "brick_dark",(x,h/2,z),(w,h,d))
            floors=max(5,round(h/3.2))
            for floor in range(floors):
                y=2.0+floor*3.2
                if y>h-1:
                    break
                for col in range(5):
                    wx=x+(col-2)*(w/5.4)
                    add_window(geometry,wx,y,z-d/2,w*.115,1.42)
                    # Narrow balcony slabs and metal rails, a common mid-rise rhythm.
                    geometry.box("concrete",(wx,y-.82,z-d/2-.38),(w*.14,.09,.74))
                    geometry.box("tower_frame",(wx,y-.58,z-d/2-.72),(w*.14,.055,.05))
                    for sign in (-1,1):
                        geometry.box("tower_frame",(wx+sign*w*.07,y-.70,z-d/2-.72),(.035,.27,.04))
                geometry.box("concrete",(x,y-1.62,z-d/2-.12),(w+.2,.15,.26))
            geometry.box("concrete",(x,h-.7,z),(w+.7,1.1,d+.7))
            geometry.box("brick_dark",(x,h+1.0,z),(w*.82,1.1,d*.76))
            geometry.cylinder("concrete",(x-w*.28,h+2.5,z+d*.2),1.25,2.0,12)
    else:
        coords=[(-22,-22,32,34,70),(21,-22,32,34,94),(-21,21,31,34,83),(22,21,31,34,58)]
        for idx,(x,z,w,d,h) in enumerate(coords):
            geometry.box("glass_blue" if idx%2==0 else "dark_glass",(x,h/2,z),(w,h,d))
            # Vertical concrete mullions, floor slabs, and amber interior cores.
            for col in range(5):
                wx=x+(col-2)*w/5.0
                geometry.box("tower_frame",(wx,h/2,z-d/2-.06),(.20,h,.12))
            floors=round(h/3.3)
            for floor in range(1,floors):
                y=floor*3.3
                geometry.box("tower_frame",(x,y,z-d/2-.08),(w+.1,.16,.16))
            geometry.box("concrete",(x,h+.7,z),(w+2.4,1.4,d+2.4))
            geometry.box("tower_frame",(x,h+1.6,z),(w*.7,.45,d*.68))
            geometry.box("glass_blue",(x,h+2.1,z),(w*.34,.5,d*.35))
    # A shared patch of planted courtyard in each block adds variation and breathing room.
    geometry.box("grass",(0,.14,0),(8,.2,8))
    return geometry


def build_block(path: Path, style: str) -> None:
    gltf=Gltf(style)
    mesh=gltf.add_mesh(style+" merged facade",build_block_geometry(style))
    gltf.add_node(style,mesh)
    gltf.write(path)


def build_bogota_city(path: Path) -> None:
    """Pack a complete, repeated central-Bogotá district into one reusable GLB scene."""
    styles = ("bogota-la-candelaria-block", "bogota-brick-midrise-block", "bogota-modern-block")
    gltf = Gltf("Bogotá · central city districts")
    mesh_ids = {
        style: gltf.add_mesh(style, build_block_geometry(style))
        for style in styles
    }
    map_geometry = MeshData()
    map_geometry.box("grass", (0, -0.65, 0), (2400, 0.30, 2400))
    for street in range(-6, 6):
        coordinate = street * 120 + 60
        if abs(coordinate) < 145:
            continue
        avenue = abs(coordinate // 60) % 3 == 0
        width = 20 if avenue else 14
        map_geometry.box("asphalt", (coordinate, 0.035, 0), (width, 0.08, 2400))
        map_geometry.box("asphalt", (0, 0.035, coordinate), (2400, 0.08, width))
        for side in (-1, 1):
            offset = width / 2 + 2.8
            map_geometry.box("sidewalk", (coordinate + side * offset, 0.09, 0), (5.6, 0.16, 2400))
            map_geometry.box("sidewalk", (0, 0.09, coordinate + side * offset), (2400, 0.16, 5.6))
    map_geometry.box("asphalt", (90, 0.12, 0), (25, 0.22, 1500))
    map_geometry.box("brick_red", (84.5, 0.28, 0), (5.2, 0.12, 1450))
    map_geometry.box("brick_red", (95.5, 0.28, 0), (5.2, 0.12, 1450))
    map_mesh = gltf.add_mesh("Bogotá streets and basin", map_geometry)
    gltf.add_node("Bogotá basin · roads and sidewalks", map_mesh)
    landmarks = MeshData()
    landmarks.box("sidewalk", (0, 0.13, 0), (170, 0.20, 150))
    landmarks.box("stucco_cream", (0, 19, 0), (92, 38, 62))  # Capitolio Nacional
    for column in range(8):
        landmarks.box("concrete", (-36 + column * 10, 12, -31.8), (1.3, 20, 1.3))
    landmarks.box("concrete", (0, 40, 0), (96, 3, 66))
    landmarks.box("dark_glass", (120, 102, -100), (55, 204, 55))  # Torre Colpatria
    for level in range(1, 8):
        landmarks.box("tower_frame", (120, level * 25, -128), (56, 1, 1))
    landmarks.box("concrete", (120, 207, -100), (20, 6, 20))
    landmarks.box("brick_red", (260, 16, -390), (122, 32, 96))  # Estadio El Campín
    landmarks.box("grass", (260, 33, -390), (72, 0.5, 48))
    landmarks.box("concrete", (-790, 11, -485), (150, 22, 68))  # Terminal El Dorado
    landmarks.box("asphalt", (-790, 0.16, -485), (380, 0.16, 54))  # Pista
    for x, y, z, rx, ry, rz in (
        (1090, 210, -760, 250, 210, 310), (1110, 260, -460, 280, 260, 340),
        (1080, 305, -130, 300, 305, 370), (1110, 275, 235, 280, 275, 340),
        (1090, 235, 590, 260, 235, 310), (1120, 185, 885, 210, 185, 250),
    ):
        landmarks.sphere("grass", (x, y, z), (rx, ry, rz), 20, 10)
    landmarks.sphere("grass", (790, 178, -110), (138, 185, 185), 22, 12)  # Monserrate
    landmarks.box("stucco_cream", (790, 372, -110), (28, 18, 40))
    landmarks.sphere("grass", (880, 110, 190), (104, 112, 145), 20, 10)  # Guadalupe
    landmarks.box("concrete", (880, 298, 190), (3, 26, 3))
    landmark_mesh = gltf.add_mesh("Bogotá landmarks · Capitolio, Colpatria, El Campín, El Dorado and cerros", landmarks)
    gltf.add_node("Bogotá landmarks", landmark_mesh)
    excluded = [
        (0, 0, 155), (120, -100, 74), (-120, 80, 68), (-80, -90, 68),
        (100, 120, 74), (-250, -420, 145), (260, -390, 118),
        (-790, -360, 160), (360, 540, 90), (790, -110, 195), (880, 190, 155),
    ]
    for gx in range(-6, 7):
        for gz in range(-6, 7):
            x, z = gx * 120, gz * 120
            if any(math.hypot(x - sx, z - sz) < radius for sx, sz, radius in excluded):
                continue
            if x >= 720 and abs(z) <= 1000:
                continue
            if abs(x - 90) < 72 and abs(z) < 770:
                continue
            if math.hypot(x, z) < 405:
                style = "bogota-la-candelaria-block"
            elif (z < -360 and (gx + gz) % 3 == 0) or x > 360:
                style = "bogota-modern-block"
            else:
                style = "bogota-brick-midrise-block"
            quarter_turns = (gx - gz) % 4
            angle = quarter_turns * math.pi / 2
            rotation = (0.0, math.sin(angle / 2), 0.0, math.cos(angle / 2))
            gltf.add_node(
                f"Manzana {style} {gx:+d}_{gz:+d}",
                mesh_ids[style],
                translation=(float(x), 0.0, float(z)),
                rotation=rotation,
            )
    gltf.write(path)


def main() -> None:
    OUT.mkdir(parents=True,exist_ok=True)
    build_hero(OUT/"superman-bogota.glb")
    build_block(OUT/"bogota-la-candelaria-block.glb","bogota-la-candelaria-block")
    build_block(OUT/"bogota-brick-midrise-block.glb","bogota-brick-midrise-block")
    build_block(OUT/"bogota-modern-block.glb","bogota-modern-block")
    build_bogota_city(OUT/"bogota-city.glb")
    for asset in sorted(OUT.glob("*.glb")):
        print(f"{asset.name}: {asset.stat().st_size / 1024:.1f} KB")


if __name__=="__main__":
    main()
