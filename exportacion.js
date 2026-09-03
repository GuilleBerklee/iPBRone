/**
 * Módulo para empaquetar y exportar mapas PBR para diferentes motores.
 */
export class TextureExporter {

  /**
   * Helper para convertir un HTMLCanvasElement a Blob de forma asíncrona.
   */
  static canvasToBlob(canvas) {
    return new Promise((resolve) => {
      if (!canvas) resolve(null);
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  /**
   * Empaqueta canales para Unreal Engine: Red = AO, Green = Roughness, Blue = Metallic (ORM).
   */
  static createORMTexture(aoCanvas, roughnessCanvas, metallicCanvas) {
    const w = aoCanvas?.width || roughnessCanvas?.width || 1024;
    const h = aoCanvas?.height || roughnessCanvas?.height || 1024;

    const ormCanvas = document.createElement('canvas');
    ormCanvas.width = w;
    ormCanvas.height = h;
    const ctx = ormCanvas.getContext('2d');
    const ormData = ctx.createImageData(w, h);

    const aoData = aoCanvas ? aoCanvas.getContext('2d').getImageData(0, 0, w, h).data : null;
    const roughData = roughnessCanvas ? roughnessCanvas.getContext('2d').getImageData(0, 0, w, h).data : null;
    const metalData = metallicCanvas ? metallicCanvas.getContext('2d').getImageData(0, 0, w, h).data : null;

    for (let i = 0; i < ormData.data.length; i += 4) {
      // Canal R: Ambient Occlusion (por defecto blanco 255 si no existe)
      ormData.data[i] = aoData ? aoData[i] : 255;
      // Canal G: Roughness (por defecto gris 128 si no existe)
      ormData.data[i + 1] = roughData ? roughData[i] : 128;
      // Canal B: Metallic (por defecto negro 0 si no existe)
      ormData.data[i + 2] = metalData ? metalData[i] : 0;
      // Alfa siempre al 100%
      ormData.data[i + 3] = 255;
    }

    ctx.putImageData(ormData, 0, 0);
    return ormCanvas;
  }

  /**
   * Genera script Python para importación automática de nodos en Blender.
   */
  static generateBlenderScript(materialName) {
    return `import bpy
import os

dir_path = os.path.dirname(bpy.data.filepath) if bpy.data.filepath else os.path.dirname(__file__)
mat_name = "${materialName}"

mat = bpy.data.materials.get(mat_name) or bpy.data.materials.new(name=mat_name)
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()

# Crear nodos base
output = nodes.new(type='ShaderNodeOutputMaterial')
output.location = (400, 0)

bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
bsdf.location = (0, 0)
links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

tex_coord = nodes.new(type='ShaderNodeTexCoord')
tex_coord.location = (-800, 0)

mapping = nodes.new(type='ShaderNodeMapping')
mapping.location = (-600, 0)
links.new(tex_coord.outputs['UV'], mapping.inputs['Vector'])

def load_texture(filename, is_non_color=True, location=(-300, 0)):
    filepath = os.path.join(dir_path, filename)
    if not os.path.exists(filepath):
        return None
    node = nodes.new(type='ShaderNodeTexImage')
    node.location = location
    img = bpy.data.images.load(filepath)
    if is_non_color:
        img.colorspace_settings.name = 'Non-Color'
    node.image = img
    links.new(mapping.outputs['Vector'], node.inputs['Vector'])
    return node

# Cargar y conectar mapas
color_node = load_texture("${materialName}_Color.png", is_non_color=False, location=(-300, 300))
if color_node:
    links.new(color_node.outputs['Color'], bsdf.inputs['Base Color'])

rough_node = load_texture("${materialName}_Roughness.png", is_non_color=True, location=(-300, 0))
if rough_node:
    links.new(rough_node.outputs['Color'], bsdf.inputs['Roughness'])

normal_node = load_texture("${materialName}_Normal.png", is_non_color=True, location=(-300, -300))
if normal_node:
    nmap = nodes.new(type='ShaderNodeNormalMap')
    nmap.location = (-100, -300)
    links.new(normal_node.outputs['Color'], nmap.inputs['Color'])
    links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])

disp_node = load_texture("${materialName}_Displacement.png", is_non_color=True, location=(-300, -600))
if disp_node:
    disp = nodes.new(type='ShaderNodeDisplacement')
    disp.location = (-100, -600)
    links.new(disp_node.outputs['Color'], disp.inputs['Height'])
    links.new(disp.outputs['Displacement'], output.inputs['Displacement'])

print("Material '${materialName}' cargado con éxito en Blender.")
`;
  }

  /**
   * Exporta ZIP estándar con todos los mapas individuales.
   */
  static async exportStandardZip(maps, materialName = 'PBR_Texture') {
    const zip = new JSZip();

    if (maps.albedo) zip.file(`${materialName}_BaseColor.png`, await this.canvasToBlob(maps.albedo));
    if (maps.normal) zip.file(`${materialName}_Normal.png`, await this.canvasToBlob(maps.normal));
    if (maps.roughness) zip.file(`${materialName}_Roughness.png`, await this.canvasToBlob(maps.roughness));
    if (maps.height) zip.file(`${materialName}_Displacement.png`, await this.canvasToBlob(maps.height));
    if (maps.ao) zip.file(`${materialName}_AO.png`, await this.canvasToBlob(maps.ao));

    const content = await zip.generateAsync({ type: 'blob' });
    this.downloadBlob(content, `${materialName}_PBR.zip`);
  }

  /**
   * Exporta paquete optimizado para Unreal Engine (con ORM packed texture).
   */
  static async exportUnrealEngineZip(maps, materialName = 'T_Material') {
    const zip = new JSZip();

    if (maps.albedo) zip.file(`${materialName}_D.png`, await this.canvasToBlob(maps.albedo));
    if (maps.normal) zip.file(`${materialName}_N.png`, await this.canvasToBlob(maps.normal));
    if (maps.height) zip.file(`${materialName}_H.png`, await this.canvasToBlob(maps.height));

    // Generar textura ORM (Occlusion, Roughness, Metallic)
    const ormCanvas = this.createORMTexture(maps.ao, maps.roughness, maps.metallic);
    zip.file(`${materialName}_ORM.png`, await this.canvasToBlob(ormCanvas));

    const content = await zip.generateAsync({ type: 'blob' });
    this.downloadBlob(content, `${materialName}_UnrealPack.zip`);
  }

  /**
   * Exporta paquete para Blender con script auto-setup incluido.
   */
  static async exportBlenderZip(maps, materialName = 'Material') {
    const zip = new JSZip();

    if (maps.albedo) zip.file(`${materialName}_Color.png`, await this.canvasToBlob(maps.albedo));
    if (maps.normal) zip.file(`${materialName}_Normal.png`, await this.canvasToBlob(maps.normal));
    if (maps.roughness) zip.file(`${materialName}_Roughness.png`, await this.canvasToBlob(maps.roughness));
    if (maps.height) zip.file(`${materialName}_Displacement.png`, await this.canvasToBlob(maps.height));
    if (maps.ao) zip.file(`${materialName}_AO.png`, await this.canvasToBlob(maps.ao));

    // Incluir script Python de setup automático
    zip.file(`import_material.py`, this.generateBlenderScript(materialName));

    const content = await zip.generateAsync({ type: 'blob' });
    this.downloadBlob(content, `${materialName}_BlenderPack.zip`);
  }

  static downloadBlob(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
}