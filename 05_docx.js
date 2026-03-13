import { storage, sRef, uploadBytes, getDownloadURL } from "./01_firebase.js";

// ─ Imagen en Word ─
const IMG_WORD = (W, alt) => {
    const cx = Math.round(W * 914.4 * 0.95); // EMU ≈ ancho página
    const cy = Math.round(cx * 300/800);      // ratio 800x300
    return `<w:p><w:pPr><w:spacing w:after="0" w:before="60"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="99" name="${alt}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="${alt}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId9"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
};

// ─ buildDocx ─
const buildDocx = async (fn,body,titulo,extraFiles) => {
    const JSZip=await loadJSZip(); const zip=new JSZip();
    zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>`);
    zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    zip.file('word/_rels/document.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>');
    zip.file('word/_rels/header1.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.jpeg"/></Relationships>`);
    zip.file('word/styles.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`);
    zip.file('word/header1.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:p><w:pPr><w:spacing w:before="60" w:after="140" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251657216" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>-517830</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>-344323</wp:posOffset></wp:positionV><wp:extent cx="1053389" cy="599440"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="1" name="logo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="logo"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:srcRect/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr bwMode="auto"><a:xfrm><a:off x="0" y="0"/><a:ext cx="1053389" cy="599440"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r><w:r><w:rPr><w:b/><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:color w:val="2C3E50"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t xml:space="preserve">                          BORYBOR NORTE   |   ${xE(titulo)}</w:t></w:r></w:p></w:hdr>`);
    zip.file('word/media/logo.jpeg', Uint8Array.from(atob(LOGO_B64),c=>c.charCodeAt(0)));
    zip.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rId6"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="1080" w:bottom="900" w:left="1080" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
    // Archivos extra (ej: gráfico de temperatura)
    if (extraFiles) {
        for (const [path, data] of Object.entries(extraFiles)) { zip.file(path, data); }
        // Si hay imagen del gráfico, actualizar rels para incluir rId9
        if (extraFiles['word/media/temp_chart.png']) {
            zip.file('word/_rels/document.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/temp_chart.png"/></Relationships>');
        }
    }
    const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=fn; a.click();
};

// ════════════════════════════════════════════
//  DETALLE  —  todo lo del área Calidad/Detalle
// ════════════════════════════════════════════
window.descargarGuiaRecepcion = async (i) => {
    const d = window.data[i];
    const rec = d.recepcion || {};
    const piezas = d.piezas_recepcion || [];
    const W = 9026;
    const body = [
        SP(0),
        // Encabezado
        TABLA([4513,4513],[TR([
            TC(4513,'FFFFFF',`<w:r><w:rPr>${CAL(20,'004F88',true)}</w:rPr><w:t>INGENIERÍA ELÉCTRICA BORYBOR SpA.</w:t></w:r>`,false),
            TC(4513,'FFFFFF',`<w:r><w:rPr>${CAL(22,'004F88',true)}</w:rPr><w:t>GUÍA DE RECEPCIÓN</w:t></w:r>`,true),
        ])]), SP(0),
        TABLA([4513,4513],[TR([
            TC(4513,'FFFFFF',`<w:r><w:rPr>${CAL(14,'888888')}</w:rPr><w:t>Calle 8 N°1194 - Manzana G2 - Lote 122, Barrio Industrial - Paipote - Copiapó</w:t></w:r>`,false),
            TC(4513,'F5F6F7',`<w:r><w:rPr>${CAL(20,'2C3E50',true)}</w:rPr><w:t>O.T.:  ${xE(d.ot)}</w:t></w:r>`,true),
        ])]), SP(0),

        // Datos cliente
        SECC('DATOS DEL CLIENTE'), SP(0),
        TABLA([2256,2256,2257,2257],[
            TR([TH('NOMBRE CLIENTE',2256,false),TD(d.empresa,2256,false,false,0),TH('GUÍA DESPACHO',2257,false),TD(rec.guia,2257)]),
            TR([TH('R.U.T.',2256,false),TD(rec.rut,2256),TH('FECHA RECEPCIÓN',2257,false),TD(rec.fecha?(rec.fecha.split('-').reverse().join('/')):'-',2257)]),
            TR([TH('CORRIENTE ALTERNA',2256,false),
                TC(2256,rec.corriente==='alterna'?'E8F8F0':'FFFFFF',`<w:r><w:rPr>${CAL(16,rec.corriente==='alterna'?'27AE60':'888888',true)}</w:rPr><w:t>${rec.corriente==='alterna'?'☑':'☐'}</w:t></w:r>`,true),
                TH('CORRIENTE CONTINUA',2257,false),
                TC(2257,rec.corriente==='continua'?'E8F8F0':'FFFFFF',`<w:r><w:rPr>${CAL(16,rec.corriente==='continua'?'27AE60':'888888',true)}</w:rPr><w:t>${rec.corriente==='continua'?'☑':'☐'}</w:t></w:r>`,true),
            ]),
        ]), SP(0),

        // Identificación del equipo
        SECC('IDENTIFICACIÓN DEL EQUIPO'), SP(0),
        TABLA([2256,2256,2257,2257],[
            TR([TH('MARCA',2256,false),TD(d.placa?.marca,2256),TH('FRAME',2257,false),TD(d.placa?.frame,2257)]),
            TR([TH('POTENCIA HP/CV',2256,false),TD(rec.pothp,2256),TH('KW',2257,false),TD(d.placa?.pot,2257)]),
            TR([TH('RPM',2256,false),TD(d.placa?.rpm,2256),TH('COLOR',2257,false),TD(rec.color,2257)]),
            TR([TH('N° SERIE',2256,false),TD(rec.serie,2256),TH('CICLOS (Hz)',2257,false),TD(rec.ciclos,2257)]),
            TR([TH('VOLTS',2256,false),TD(d.placa?.volt,2256),TH('AMPERES',2257,false),TD(d.placa?.amp,2257)]),
            TR([TH('OTROS',2256,false),TD(rec.otros_equipo,2256,false,false,0),TC(2257,'FFFFFF','',false),TC(2257,'FFFFFF','',false)]),
        ]), SP(0),

        // Identificación de piezas
        SECC('IDENTIFICACIÓN DE PARTES DEL EQUIPO'), SP(0),
        `<w:p><w:pPr><w:spacing w:after="0" w:before="40"/><w:ind w:left="130"/></w:pPr><w:r><w:rPr>${CAL(13,'555555',false)}</w:rPr><w:t>NOTA: Completar si el equipo contiene la pieza. De encontrarse en mal estado indicarlo en la columna correspondiente.</w:t></w:r></w:p>`,
        tabPiezasRecepcion(piezas,W), SP(0),

        // Firmas
        SECC('FIRMAS'), SP(0),
        TABLA([4513,4513],[
            TR([TH('NOMBRE RECEPTOR DEL EQUIPO',4513,false),TH('V°B° SUPERVISOR GENERAL',4513,false)],[200]),
            TR([TC(4513,'FFFFFF',`<w:r><w:rPr>${CAL(16,'2C3E50',true)}</w:rPr><w:t>${xE(rec.receptor||'')}</w:t></w:r>`,false),
                TC(4513,'FFFFFF',`<w:r><w:rPr>${CAL(16,'2C3E50',true)}</w:rPr><w:t>${xE(rec.supervisor||'')}</w:t></w:r>`,false)],[500]),
            TR([TC(4513,'FFFFFF','',false),TC(4513,'FFFFFF','',false)],[800]),
        ]),
        SP(0), PIE(),
    ].join('');
    await buildDocx(`GuiaRecepcion_OT_${d.ot}_${d.empresa}.docx`, body, 'GUÍA DE RECEPCIÓN');
};

window.descargarDetalle = async (i) => {
    const d=window.data[i], m=d.mediciones||{}, det=d.detalle||{}, obs=d.observaciones||{}, W=9026;
    const medIng={res12:m.res12,res13:m.res13,res23:m.res23,ind12:m.ind12,ind13:m.ind13,ind23:m.ind23,sur1:m.sur1,sur2:m.sur2,sur3:m.sur3,aisla:m.aisla,ipdar:m.ipdar};
    const hallazgos = d.hallazgos_lista || [];
    const body=[
        SP(0),
        tabEncab(d,W), SP(0),

        SECC('1.  DATOS DE PLACA'), SP(0),
        tabPlaca(d,W), SP(0),

        SECC('2.  HALLAZGOS DEL DESARME'), RESP((d.responsables||{}).desarme_ok), SP(0),
        tabLista(hallazgos,W), SP(0),
        F2W('OBSERVACIONES DESARME', obs.desarme||'', W), SP(0),

        SECC('3.  MEDICIONES ELÉCTRICAS DE INGRESO'), RESP((d.responsables||{}).med_ok), SP(0),
        tabMedElec(medIng,W), SP(0),

        SECC('4.  METROLOGÍA MECÁNICA'), RESP((d.responsables||{}).met_ok), SP(0),
        tabMetro(
            {enc_lc:d.met_val_lc,enc_ll:d.met_val_ll,me_lc:d.met_val_mlc,me_ll:d.met_val_mll},
            {enc_lc:'',enc_ll:'',me_lc:'',me_ll:''},W), SP(0),
        SECC('4b. CONTROL METROLÓGICO DE ALOJAMIENTOS Y ASENTAMIENTOS'), SP(0),
        tabMetroPlanillaCombinada(d,'metro_aloj_lc_ing','metro_aloj_lc_sal','ALOJAMIENTO LADO CARGA (Drive End)',W), SP(0),
        tabMetroPlanillaCombinada(d,'metro_aloj_ll_ing','metro_aloj_ll_sal','ALOJAMIENTO LADO LIBRE (Non Drive End)',W), SP(0),
        tabMetroPlanillaCombinada(d,'metro_asen_lc_ing','metro_asen_lc_sal','ASENTAMIENTO LADO CARGA (Drive End)',W), SP(0),
        tabMetroPlanillaCombinada(d,'metro_asen_ll_ing','metro_asen_ll_sal','ASENTAMIENTO LADO LIBRE (Non Drive End)',W), SP(0),
        F2W('OBSERVACIONES METROLOGÍA', obs.metrologia||'', W), SP(0),

        SECC('5.  RODAMIENTOS'), SP(0),
        tabRodamientos(d,W), SP(0),

        SECC('6.  PARTES / PIEZAS / COMPONENTES'), SP(0),
        tabChecks(TRABAJOS_LIST,det,W), SP(0),

        SECC('7.  TIPO DE FALLA'), SP(0),
        tabChecks(FALLAS_LIST,det,W), SP(0),

        SECC('8.  OBSERVACIONES'), SP(0),
        tabObsAreas([
            ['Desarme', obs.desarme||''],
            ['Detalle', obs.detalle||''],
        ], W),

        SP(0), PIE(),
    ].join('');
    await buildDocx(`Detalle_OT_${d.ot}_${d.empresa}.docx`,body,'REGISTRO DE DETALLE');
};

// ════════════════════════════════════════════
//  INFORME FINAL  —  TODA la información
// ════════════════════════════════════════════
window.descargarInforme = async (i) => {
    const d=window.data[i], m=d.mediciones||{}, obs=d.observaciones||{}, b=d.bobinado||{}, W=9026;
    // Mediciones ingreso
    const medIng={res12:m.res12,res13:m.res13,res23:m.res23,ind12:m.ind12,ind13:m.ind13,ind23:m.ind23,sur1:m.sur1,sur2:m.sur2,sur3:m.sur3,aisla:m.aisla,ipdar:m.ipdar};
    // Mediciones salida
    const medSal={res12:m.res_salida12,res13:m.res_salida13,res23:m.res_salida23,ind12:m.ind_salida12,ind13:m.ind_salida13,ind23:m.ind_salida23,sur1:m.surge_salida1,sur2:m.surge_salida2,sur3:m.surge_salida3,aisla:m.aisla_salida,ipdar:m.ipdar_salida};
    // Metrología: iniciales desde área mecánica, finales desde ejecución
    const metIni={enc_lc:d.met_val_lc,enc_ll:d.met_val_ll,me_lc:d.met_val_mlc,me_ll:d.met_val_mll};
    const metSal={enc_lc:d.ejec_enc_lc,enc_ll:d.ejec_enc_ll,me_lc:d.ejec_met_lc,me_ll:d.ejec_met_ll};
    const det=d.detalle||{};

    const hallazgos = d.hallazgos_lista || [];
    const termLista = d.terminaciones_lista || [];
    const termChecks = d.terminaciones_checks || {};
    const tempRegs = d.temp_registros || [];
    const piezasRec = d.piezas_recepcion || [];
    const piezasSalida = d.piezas_salida_estado || {};
    const rec = d.recepcion || {};
    const tarDesarme   = d.tareas_desarme      || [];
    const tarMant      = d.tareas_mantencion    || [];
    const tarCalidad   = d.tareas_calidad       || [];
    const tarMecIng    = d.tareas_mecanica_ing  || [];
    const tarMec       = d.tareas_mecanica      || [];
    const tarArmado    = d.tareas_armado        || [];
    const tarPruebas   = d.tareas_pruebas       || [];

    // ── Generar PNG del gráfico de temperatura ──
    let tempChartPng = null;
    if (tempRegs.length >= 2) {
        try {
            const expCv = document.createElement('canvas');
            expCv.width = 800; expCv.height = 260;
            expCv.style.position = 'fixed';
            expCv.style.left = '-9999px';
            expCv.style.top = '-9999px';
            document.body.appendChild(expCv);
            window._dibujarGrafEnCanvas(expCv, tempRegs, true);
            tempChartPng = expCv.toDataURL('image/png').split(',')[1];
            document.body.removeChild(expCv);
        } catch(e) { console.warn('Error generando gráfico:', e); }
    }

    const body=[
        SP(0),
        tabEncab(d,W), SP(0),

        // ── 1. DATOS DE RECEPCIÓN ──
        SECC('1.  DATOS DE RECEPCIÓN'), SP(0),
        TABLA([2256,2256,2257,2257],[
            TR([TH('CLIENTE',2256,false),TD(d.empresa,2256),TH('R.U.T.',2257,false),TD(rec.rut,2257)]),
            TR([TH('FECHA RECEPCIÓN',2256,false),TD(rec.fecha?(rec.fecha.split('-').reverse().join('/')):'-',2256),TH('GUÍA DESPACHO',2257,false),TD(rec.guia,2257)]),
            TR([TH('CORRIENTE',2256,false),TD((rec.corriente||'').toUpperCase(),2256),TH('RECEPTOR',2257,false),TD(rec.receptor,2257)]),
            TR([TH('SUPERVISOR',2256,false),TD(rec.supervisor,2256),TH('COLOR',2257,false),TD(rec.color,2257)]),
            TR([TH('N° SERIE',2256,false),TD(rec.serie,2256),TH('CICLOS (Hz)',2257,false),TD(rec.ciclos,2257)]),
        ]), SP(0),

        // ── 2. DATOS DE PLACA ──
        SECC('2.  DATOS DE PLACA'), SP(0),
        tabPlaca(d,W), SP(0),

        // ── 3. PIEZAS RECIBIDAS / SALIDA ──
        SECC('3.  IDENTIFICACIÓN DE PIEZAS'), SP(0),
        tabPiezasSalida(piezasRec, piezasSalida, W), SP(0),

        // ── 4. DESARME ──
        SECC('4.  DESARME'), RESP((d.responsables||{}).desarme_ok), SP(0),
        tabLista(hallazgos,W), SP(0),
        tarDesarme.length>0 ? SECC('    TAREAS DE DESARME') : '',
        tarDesarme.length>0 ? tabLista(tarDesarme,W) : '',
        tarMant.length>0 ? SECC('    TAREAS DE MANTENCIÓN') : '',
        RESP((d.responsables||{}).mant_ok),
        tarMant.length>0 ? tabLista(tarMant,W) : '',
        SP(0), F2W('OBSERVACIONES DESARME', obs.desarme||'', W), SP(0),

        // ── 5. MEDICIONES ELÉCTRICAS DE INGRESO ──
        SECC('5.  MEDICIONES ELÉCTRICAS DE INGRESO'), RESP((d.responsables||{}).med_ok), SP(0),
        tabMedElec(medIng,W), SP(0),
        tarCalidad.length>0 ? SECC('    TAREAS DE CALIDAD / MEDICIONES') : '',
        tarCalidad.length>0 ? tabLista(tarCalidad,W) : '',
        F2W('OBSERVACIONES', obs.med_ingreso||'', W), SP(0),

        // ── 6. METROLOGÍA MECÁNICA ──
        SECC('6.  METROLOGÍA MECÁNICA'), RESP((d.responsables||{}).met_ok), SP(0),
        SECC('   CONTROL METROLÓGICO DE ALOJAMIENTOS Y ASENTAMIENTOS'), SP(0),
        tabMetroPlanillaCombinada(d,'metro_aloj_lc_ing','metro_aloj_lc_sal','ALOJAMIENTO LADO CARGA (Drive End)',W), SP(0),
        tabMetroPlanillaCombinada(d,'metro_aloj_ll_ing','metro_aloj_ll_sal','ALOJAMIENTO LADO LIBRE (Non Drive End)',W), SP(0),
        tabMetroPlanillaCombinada(d,'metro_asen_lc_ing','metro_asen_lc_sal','ASENTAMIENTO LADO CARGA (Drive End)',W), SP(0),
        tabMetroPlanillaCombinada(d,'metro_asen_ll_ing','metro_asen_ll_sal','ASENTAMIENTO LADO LIBRE (Non Drive End)',W), SP(0),

        tarMecIng.length>0 ? SECC('    TAREAS METROLOGÍA INGRESO') : '',
        tarMecIng.length>0 ? tabLista(tarMecIng,W) : '',
        (()=>{
            const revItems = [
                {k:'contratapa_lc', label:'Revisión Contratapa Lado Carga'},
                {k:'contratapa_ll', label:'Revisión Contratapa Lado Libre'},
                {k:'slingues_lc',   label:'Revisión de Slingues LC'},
                {k:'slingues_ll',   label:'Revisión de Slingues LL'},
                {k:'machon_acople', label:'Machón o Acople'},
                {k:'eje_acople',    label:'Eje Acople'},
                {k:'ventilador',    label:'Ventilador'},
                {k:'otros',         label:'Otros'},
            ];
            const checks = d.metro_revision_checks || {};
            const hasData = revItems.some(it => checks[it.k]?.obs);
            if (!hasData) return '';
            const rows = revItems.map(it => {
                const ch = checks[it.k] || {};
                return TR([
                    TC(3500,'',`<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>${it.label}</w:t></w:r>`,false),
                    TC(1000,ch.ok?'C6EFCE':'',`<w:r><w:rPr><w:sz w:val="18"/><w:b/></w:rPr><w:t xml:space="preserve">${ch.ok?'✅ OK':'—'}</w:t></w:r>`,true),
                    TC(W-4500,'',`<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${ch.obs||'—'}</w:t></w:r>`,false),
                ]);
            }).join('');
            return SECC('    LISTA DE REVISIÓN VISUAL DE INGRESO') +
                `<w:tbl><w:tblPr><w:tblW w:w="${W}" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="BFBFBF"/><w:left w:val="single" w:sz="4" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="4" w:color="BFBFBF"/><w:right w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideH w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideV w:val="single" w:sz="4" w:color="BFBFBF"/></w:tblBorders></w:tblPr>` +
                TR([TH('Ítem de Revisión',3500),TH('Estado',1000),TH('Observación',W-4500)]) +
                rows + `</w:tbl>`;
        })(),
        RESP((d.responsables||{}).mec_fin),
        tarMec.length>0 ? SECC('    TAREAS MECÁNICA FINAL') : '',
        tarMec.length>0 ? tabLista(tarMec,W) : '',
        SP(0), F2W('OBSERVACIONES', obs.metrologia||'', W), SP(0),

        // ── 7. DATOS DE BOBINADO (plana completa) ──
        `<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>`,
        SECC('7.  DATOS DE BOBINADO'), RESP((d.responsables||{}).bobinado_fin), SP(0),
        tabBobCompleto(d,W), SP(0),
        `<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>`,

        // ── 8. PARTES / PIEZAS / COMPONENTES ──
        SECC('8.  PARTES / PIEZAS / COMPONENTES'), SP(0),
        tabChecks(TRABAJOS_LIST,det,W), SP(0),
        SECC('    TIPO DE FALLA'), SP(0),
        tabChecks(FALLAS_LIST,det,W), SP(0),

        // ── 9. RODAMIENTOS Y ARMADO ──
        SECC('9.  RODAMIENTOS Y ARMADO'), RESP((d.responsables||{}).armado_ok), SP(0),
        tabRodamientos(d,W), SP(0),
        tarArmado.length>0 ? SECC('    TAREAS DE ARMADO') : '',
        tarArmado.length>0 ? tabLista(tarArmado,W) : '',
        F2W('OBSERVACIONES ARMADO', obs.armado||'', W), SP(0),

        // ── 10. MEDICIONES ELÉCTRICAS DE SALIDA ──
        SECC('10. MEDICIONES ELÉCTRICAS DE SALIDA'), RESP((d.responsables||{}).pruebas_ok), SP(0),
        tabMedElec(medSal,W), SP(0),

        // ── 11. PRUEBAS DINÁMICAS ──
        SECC('11. PRUEBAS DINÁMICAS'), RESP((d.responsables||{}).pruebas_ok), SP(0),
        tabPruebas(d,W), SP(0),
        tarPruebas.length>0 ? SECC('    TAREAS DE PRUEBAS DINÁMICAS') : '',
        tarPruebas.length>0 ? tabLista(tarPruebas,W) : '',
        F2W('OBSERVACIONES PRUEBAS', obs.pruebas||'', W), SP(0),

        // ── 12. REGISTRO DE TEMPERATURAS ──
        SECC('12. REGISTRO DE TEMPERATURAS'), SP(0),
        tabTemperaturas(tempRegs,W), SP(0),
        tempChartPng ? IMG_WORD(W, 'Gráfico de Temperaturas') : '',

        // ── 13. TERMINACIONES ──
        SECC('13. TERMINACIONES'), RESP((d.responsables||{}).term_ok), SP(0),
        tabTerminaciones(termLista,termChecks,W), SP(0),
        F2W('OBSERVACIONES TERMINACIONES', obs.terminaciones||'', W), SP(0),

        // ── 14. OBSERVACIONES POR ÁREA ──
        SECC('14. OBSERVACIONES POR ÁREA'), SP(0),
        tabObsAreas([
            ['Desarme',       obs.desarme||'',       (d.responsables||{}).desarme_ok||''],
            ['Mantención',    obs.mantencion||'',    (d.responsables||{}).mant_ok||''],
            ['Mediciones',    obs.med_ingreso||'',   (d.responsables||{}).med_ok||''],
            ['Metrología',    obs.metrologia||'',    (d.responsables||{}).met_ok||''],
            ['Mecánica',      obs.mecanica||'',      (d.responsables||{}).mec_fin||''],
            ['Bobinado',      obs.bobinado||'',      (d.responsables||{}).bobinado_fin||''],
            ['Balanceo',      obs.balanceo||'',      (d.responsables||{}).bal_ok||''],
            ['Armado',        obs.armado||'',        (d.responsables||{}).armado_ok||''],
            ['Pruebas',       obs.pruebas||'',       (d.responsables||{}).pruebas_ok||''],
            ['Terminaciones', obs.terminaciones||'', (d.responsables||{}).term_ok||''],
            ['Salida',        obs.salida||'',        (d.responsables||{}).salida_ok||''],
        ],W),

        SP(0), PIE(),
    ].join('');
    const extraFiles = {};
    if (tempChartPng) extraFiles['word/media/temp_chart.png'] = Uint8Array.from(atob(tempChartPng), c2=>c2.charCodeAt(0));
    await buildDocx(`Informe_OT_${d.ot}_${d.empresa}.docx`, body, 'PROTOCOLO TÉCNICO FINAL', extraFiles);
};

        window.nuevaOT = () => {
    const ot = (document.getElementById('not')?.value||'').trim();
    const em = (document.getElementById('nemp')?.value||'').trim();
    if(!ot || !em) return alert('Complete al menos N° OT y Cliente.');
    const PIEZAS_N = ['CARCASA','TAPA RODAMIENTO','TAPA VENTILADOR','JAULA DE ARDILLA','VENTILADOR','PLACA DE CONEXIÓN','CAJA DE CONEXIÓN','CÁNCAMOS','CHAVETA','RODAMIENTOS','POLEA','MACHÓN DE ACOPLE','PIÑÓN','CARBONES','CONTRA TAPA','INDUCIDO','COLECTOR','PORTA ESCOBILLA','RETÉN','PERNOS','INTERCAMBIADOR','CONEXIÓN A TIERRA','OTROS (ESPECIFICAR)'];
    const piezas = PIEZAS_N.map((nombre,pi) => {
        const rad = document.querySelector(`input[name="pieza_${pi}"]:checked`);
        return { nombre, estado: rad?rad.value:'', obs: document.getElementById(`pobs_${pi}`)?.value||'' };
    });
    (window._piezasExtra||[]).forEach(pe => piezas.push(pe));
    const rec = {
        rut:          document.getElementById('nrut')?.value||'',
        fecha:        document.getElementById('nfecha')?.value||'',
        guia:         document.getElementById('nguia')?.value||'',
        corriente:    document.getElementById('ncorriente')?.value||'',
        receptor:     document.getElementById('nreceptor')?.value||'',
        supervisor:   document.getElementById('nsupervisor')?.value||'',
        otros_equipo: document.getElementById('notros_equipo')?.value||'',
        color:        document.getElementById('ncolor')?.value||'',
        serie:        document.getElementById('nserie')?.value||'',
        ciclos:       document.getElementById('nciclos')?.value||'',
        pothp:        document.getElementById('npothp')?.value||'',
        potkw:        document.getElementById('npotkw')?.value||'',
    };
    const nuevaEntrada = {
        ot, empresa: em, estado: 'desarme', pri: 'normal',
        pasos: {}, observaciones: {}, mediciones: {}, archivos: [],
        recepcion: rec,
        piezas_recepcion: piezas,
        piezas_recepcion_checks: {},
        placa: {
            marca: document.getElementById('nmarca')?.value||'',
            frame: document.getElementById('nframe')?.value||'',
            pot:   document.getElementById('npotkw')?.value||'',
            rpm:   document.getElementById('nrpm')?.value||'',
            volt:  document.getElementById('nvolts')?.value||'',
            amp:   document.getElementById('namps')?.value||'',
            corriente: document.getElementById('ncorriente')?.value||'',
        },
        enc_lc:'no', enc_ll:'no', met_lc:'no', met_ll:'no',
        met_val_lc:'', met_val_ll:'', met_val_mlc:'', met_val_mll:'',
        ejec_enc_lc:'', ejec_enc_ll:'', ejec_met_lc:'', ejec_met_ll:'',
        rod_lc:'', rod_ll:'', rod_lc_ok:false, rod_ll_ok:false,
        tipoTrabajo:''
    };
    window.data.push(nuevaEntrada);
    window.save();
    // Generar Word Guía de Recepción automáticamente
    const idx = window.data.length - 1;
    window.descargarGuiaRecepcion(idx);
    window.mostrarVista('dashboard');
};

window.updateFlujo = (i, paso, sig) => {
    const ot = window.data[i]?.ot;
    if (!window.puedeEditarOT(ot, window.vistaActual)) { alert('⛔ No tienes permiso para modificar esta OT en esta área.'); return; }
    if (!window.data[i].pasos) window.data[i].pasos = {};
    window.data[i].pasos[paso] = true;
    // Registrar responsable del paso
    if (!window.data[i].responsables) window.data[i].responsables = {};
    window.data[i].responsables[paso] = window.usuarioActual?.nombre || window.usuarioActual?.usuario || '—';
    if (paso === 'med_ok' || paso === 'met_ok') {
        if (window.data[i].pasos.med_ok && window.data[i].pasos.met_ok) window.data[i].estado = 'detalle_pendiente';
    } else if (sig) {
        window.data[i].estado = sig;
    }
    window.save();
};

window.agregarHallazgo = (i) => {
    const input = document.getElementById(`des_input_${i}`);
    const txt = (input?.value || '').trim();
    if (!txt) return;
    if (!window.data[i].hallazgos_lista) window.data[i].hallazgos_lista = [];
    window.data[i].hallazgos_lista.push(txt);
    input.value = '';
    window.save(); window.render();
};
window.quitarHallazgo = (i, hi) => {
    if (!window.data[i].hallazgos_lista) return;
    window.data[i].hallazgos_lista.splice(hi, 1);
    window.save(); window.render();
};

// ── Reabrir etapa (solo admin/encargado) ──────────────────
const _pasoEstadoAnterior = {
    desarme_ok:   'desarme',
    mant_ok:      null,
    med_ok:       'ingresos_pendientes',
    met_ok:       'ingresos_pendientes',
    detalle_ok:   'detalle_pendiente',
    mec_fin:      null,
    bobinado_fin: null,
    bal_ok:       null,
    armado_ok:    null,
    pruebas_ok:   'pruebas_dinamicas',
    term_ok:      'terminaciones',
    salida_ok:    'check_salida',
    salida_final: 'despacho',
};
const _pasoLabel = {
    desarme_ok:   'Desarme',
    mant_ok:      'Mantención',
    med_ok:       'Mediciones de Ingreso',
    met_ok:       'Metrología Ingreso',
    detalle_ok:   'Detalle / Ingreso Técnico',
    mec_fin:      'Mecánica Final',
    bobinado_fin: 'Bobinado',
    bal_ok:       'Balanceo',
    armado_ok:    'Armado',
    pruebas_ok:   'Pruebas Dinámicas / Mediciones Salida',
    term_ok:      'Terminaciones',
    salida_ok:    'Check de Salida',
    salida_final: 'Despacho',
};

window.reabrirPaso = (i, paso) => {
    const d = window.data[i];
    const label = _pasoLabel[paso] || paso;
    if (!confirm(`¿Reabrir "${label}" en OT ${d.ot}?\nEsto permitirá volver a editar esa etapa.`)) return;
    if (!d.pasos) d.pasos = {};
    d.pasos[paso] = false;
    const estadoAnterior = _pasoEstadoAnterior[paso];
    if (estadoAnterior) {
        // Solo retroceder si el estado actual ya pasó esa etapa
        const orden = ['espera_fecha','desarme','ingresos_pendientes','detalle_pendiente','ejecucion_trabajos','pruebas_dinamicas','terminaciones','check_salida','despacho','entregado'];
        const iActual = orden.indexOf(d.estado);
        const iAnterior = orden.indexOf(estadoAnterior);
        if (iActual > iAnterior) d.estado = estadoAnterior;
    }
    window.save();
    window.render();
    const m = document.getElementById('modalReabrir');
    if (m) m.style.display = 'none';
};

window.abrirPanelReabrir = (i) => {
    const d = window.data[i];
    const p = d.pasos || {};
    // Solo mostrar pasos que ya estén completados
    const pasosCompletos = Object.entries(_pasoLabel).filter(([k]) => p[k] === true);
    if (pasosCompletos.length === 0) {
        alert(`OT ${d.ot}: No hay etapas completadas que reabrir.`);
        return;
    }
    let html = `<div id="modalReabrir" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;" onclick="if(event.target===this)this.style.display='none'">
        <div style="background:#fff;border-radius:10px;padding:24px;max-width:420px;width:90%;max-height:80vh;overflow-y:auto;">
            <h3 style="margin:0 0 6px 0;color:#c0392b;">🔓 Reabrir etapa — OT ${d.ot}</h3>
            <p style="font-size:0.82em;color:#888;margin:0 0 14px 0;">Solo admin/encargado. Selecciona la etapa a reabrir:</p>`;
    for (const [k, label] of pasosCompletos) {
        html += `<button onclick="window.reabrirPaso(${i},'${k}')" style="display:block;width:100%;text-align:left;padding:10px 14px;margin-bottom:6px;background:#fff8f0;border:1px solid #e67e22;border-radius:6px;cursor:pointer;font-size:0.9em;color:#333;">
            🔓 ${label}</button>`;
    }
    html += `<button onclick="document.getElementById('modalReabrir').style.display='none'" style="margin-top:8px;padding:8px 20px;background:#95a5a6;color:white;border:none;border-radius:6px;cursor:pointer;">Cancelar</button>
        </div></div>`;
    // Remove existing modal if any
    const old = document.getElementById('modalReabrir');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', html);
};

// ── Mecánica: trabajos individuales por técnico ───────────
window.tomarTrabajoMec = (i, clave) => {
    if (!window.data[i].mec_trab_usuario) window.data[i].mec_trab_usuario = {};
    if (window.data[i].mec_trab_usuario[clave]?.usuario) return;
    window.data[i].mec_trab_usuario[clave] = {
        usuario: window.usuarioActual?.nombre || window.usuarioActual?.usuario || '—',
        medidas: '', archivos: [], ok: false
    };
    window.save(); window.render();
};
window.guardarRevisionCheck = (i, clave, campo, valor) => {
    if (!window.data[i].metro_revision_checks) window.data[i].metro_revision_checks = {};
    if (!window.data[i].metro_revision_checks[clave]) window.data[i].metro_revision_checks[clave] = {ok:false, obs:''};
    window.data[i].metro_revision_checks[clave][campo] = valor;
    window.save();
};
window.guardarMecMedidas = (i, clave, valor) => {
    if (!window.data[i].mec_trab_usuario?.[clave]) return;
    window.data[i].mec_trab_usuario[clave].medidas = valor;
    window.save();
};
window.finalizarTrabajoMec = (i, clave) => {
    if (!window.data[i].mec_trab_usuario?.[clave]) return;
    if (!confirm('¿Marcar este trabajo como terminado?')) return;
    window.data[i].mec_trab_usuario[clave].ok = true;
    window.save(); window.render();
};
window.subirMecArchivo = async (i, clave) => {
    const input = document.getElementById(`mecfile_${i}_${clave}`);
    const file = input?.files[0];
    if (!file) return alert('Selecciona un archivo primero');
    try {
        const storagePath = sRef(storage, `ot_${window.data[i].ot}/mec_${clave}_${Date.now()}_${file.name}`);
        await uploadBytes(storagePath, file);
        const url = await getDownloadURL(storagePath);
        if (!window.data[i].mec_trab_usuario) window.data[i].mec_trab_usuario = {};
        if (!window.data[i].mec_trab_usuario[clave]) window.data[i].mec_trab_usuario[clave] = {usuario:'',medidas:'',archivos:[],ok:false};
        if (!window.data[i].mec_trab_usuario[clave].archivos) window.data[i].mec_trab_usuario[clave].archivos = [];
        window.data[i].mec_trab_usuario[clave].archivos.push({name: file.name, url});
        window.save(); window.render();
    } catch(e) { alert('Error al subir archivo: ' + e.message); }
};

// ── Gráfico de temperatura global ─────────────────────────
// Núcleo del dibujo — recibe canvas y datos directamente
window._dibujarGrafEnCanvas = function(canvas, datos, exportMode=false) {
    if (!canvas || datos.length < 2) return;
    // Resolución 2× para pantalla, fija para exportación Word
    const DPR = exportMode ? 1 : (window.devicePixelRatio || 1);
    const cssW = exportMode ? 1100 : (canvas.offsetWidth || 760);
    const cssH = exportMode ? 340  : 260;
    canvas.width  = Math.round(cssW * DPR);
    canvas.height = Math.round(cssH * DPR);
    if (!exportMode) { canvas.style.width = cssW+'px'; canvas.style.height = cssH+'px'; }
    const W=canvas.width, H=canvas.height;
    const sc=DPR;
    const pad={t:Math.round(42*sc), r:Math.round(30*sc), b:Math.round(48*sc), l:Math.round(56*sc)};
    const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);

    // Fondo blanco limpio con borde suave
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
    // Fondo área gráfica
    ctx.fillStyle='#f8fbff';
    ctx.beginPath(); ctx.roundRect(pad.l, pad.t, cW, cH, 4*sc); ctx.fill();

    const allV=datos.flatMap(r=>[+r.lc,+r.ll,+r.est]).filter(n=>!isNaN(n));
    if (!allV.length) return;
    const rawMin=Math.min(...allV), rawMax=Math.max(...allV);
    const range = rawMax - rawMin || 10;
    const minV=Math.floor(rawMin - range*0.08);
    const maxV=Math.ceil(rawMax  + range*0.12);

    const xS=n2=>pad.l+(n2/(datos.length-1))*cW;
    const yS=v=>pad.t+cH-((v-minV)/(maxV-minV||1))*cH;

    // Grillas horizontales
    const nGrid=6;
    for(let g=0;g<=nGrid;g++){
        const gy=Math.round(pad.t+(g/nGrid)*cH)+0.5;
        const val=Math.round(maxV-((maxV-minV)/nGrid)*g);
        ctx.beginPath();
        ctx.strokeStyle = g===0||g===nGrid ? '#c8d8e8' : '#dde8f2';
        ctx.lineWidth = g===0||g===nGrid ? 1*sc : 0.7*sc;
        ctx.setLineDash([]);
        ctx.moveTo(pad.l, gy); ctx.lineTo(pad.l+cW, gy); ctx.stroke();
        ctx.fillStyle='#555'; ctx.font=`${Math.round(10.5*sc)}px Calibri,Arial`;
        ctx.textAlign='right';
        ctx.fillText(val+'°', pad.l-6*sc, gy+4*sc);
    }
    // Grillas verticales suaves
    const stepX=Math.max(1,Math.ceil(datos.length/10));
    datos.forEach((r,n)=>{
        if((n%stepX===0||n===datos.length-1) && n>0 && n<datos.length-1) {
            const gx=Math.round(xS(n))+0.5;
            ctx.beginPath(); ctx.strokeStyle='#e8eef5'; ctx.lineWidth=0.7*sc;
            ctx.moveTo(gx,pad.t); ctx.lineTo(gx,pad.t+cH); ctx.stroke();
        }
    });
    // Borde del área
    ctx.strokeStyle='#b8cfe0'; ctx.lineWidth=1.2*sc; ctx.setLineDash([]);
    ctx.strokeRect(pad.l, pad.t, cW, cH);

    // Etiquetas eje X
    ctx.fillStyle='#444'; ctx.font=`${Math.round(10.5*sc)}px Calibri,Arial`; ctx.textAlign='center';
    datos.forEach((r,n)=>{ if(n%stepX===0||n===datos.length-1) ctx.fillText(r.t+"'", xS(n), H-10*sc); });
    // Título ejes
    ctx.fillStyle='#666'; ctx.font=`italic ${Math.round(10*sc)}px Calibri,Arial`;
    ctx.textAlign='center'; ctx.fillText('Tiempo (min)', pad.l+cW/2, H-1*sc);
    ctx.save(); ctx.translate(12*sc, pad.t+cH/2);
    ctx.rotate(-Math.PI/2); ctx.textAlign='center';
    ctx.fillText('Temperatura (°C)', 0, 0); ctx.restore();

    const series=[
        {k:'lc', c:'#C0392B', cf:'#E74C3C', l:'L. Carga'},
        {k:'ll', c:'#1A6BA0', cf:'#3498DB', l:'L. Libre'},
        {k:'est',c:'#1A7A44', cf:'#27AE60', l:'Estator'}
    ];

    // Áreas sombreadas primero
    series.forEach(s=>{
        const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t+cH);
        grad.addColorStop(0, s.cf+'40');
        grad.addColorStop(1, s.cf+'05');
        ctx.beginPath();
        datos.forEach((r,n)=>{ n===0?ctx.moveTo(xS(n),yS(+r[s.k])):ctx.lineTo(xS(n),yS(+r[s.k])); });
        ctx.lineTo(xS(datos.length-1),pad.t+cH); ctx.lineTo(xS(0),pad.t+cH); ctx.closePath();
        ctx.fillStyle=grad; ctx.fill();
    });

    // Líneas principales con curva suave
    series.forEach(s=>{
        ctx.beginPath(); ctx.strokeStyle=s.c; ctx.lineWidth=2.2*sc;
        ctx.lineJoin='round'; ctx.lineCap='round'; ctx.setLineDash([]);
        datos.forEach((r,n)=>{ n===0?ctx.moveTo(xS(n),yS(+r[s.k])):ctx.lineTo(xS(n),yS(+r[s.k])); });
        ctx.stroke();
        // Puntos y etiquetas de valor
        datos.forEach((r,n)=>{
            const px=xS(n), py=yS(+r[s.k]);
            // Punto
            ctx.beginPath(); ctx.arc(px,py,3.5*sc,0,Math.PI*2);
            ctx.fillStyle='#ffffff'; ctx.fill();
            ctx.strokeStyle=s.c; ctx.lineWidth=1.8*sc; ctx.stroke();
            // Valor encima (solo en puntos seleccionados)
            if(n%stepX===0||n===datos.length-1){
                const lbl=r[s.k]+'°';
                const lblW=ctx.measureText(lbl).width+8*sc;
                const lblH=14*sc;
                const lblX=px-lblW/2, lblY=py-22*sc;
                ctx.fillStyle='rgba(255,255,255,0.88)';
                ctx.beginPath(); ctx.roundRect(lblX,lblY,lblW,lblH,3*sc); ctx.fill();
                ctx.fillStyle=s.c; ctx.font=`bold ${Math.round(9.5*sc)}px Calibri,Arial`;
                ctx.textAlign='center'; ctx.fillText(lbl, px, py-11*sc);
            }
        });
    });

    // Leyenda elegante arriba derecha
    const legX=pad.l+cW-4*sc, legY=pad.t+8*sc;
    const legW=110*sc, legH=(series.length*18+10)*sc;
    ctx.fillStyle='rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.roundRect(legX-legW, legY, legW, legH, 5*sc); ctx.fill();
    ctx.strokeStyle='#c0cfe0'; ctx.lineWidth=0.8*sc; ctx.stroke();
    series.forEach((s,si)=>{
        const ly=legY+10*sc+si*18*sc;
        ctx.fillStyle=s.c; ctx.fillRect(legX-legW+8*sc, ly-5*sc, 18*sc, 8*sc);
        ctx.fillStyle='#333'; ctx.font=`${Math.round(10*sc)}px Calibri,Arial`;
        ctx.textAlign='left'; ctx.fillText(s.l, legX-legW+30*sc, ly+2*sc);
    });
};

window.dibujarGraficoTemp = function(idx) {
    const datos = window.data[idx]?.temp_registros || [];
    const canvas = document.getElementById('temp_chart_'+idx);
    const msg    = document.getElementById('temp_chart_msg_'+idx);
    if (!canvas) return;
    if (datos.length < 2) {
        canvas.style.display='none';
        if (msg) msg.style.display='block';
        return;
    }
    canvas.style.display='block';
    if (msg) msg.style.display='none';
    window._dibujarGrafEnCanvas(canvas, datos);
};


window.agregarRodamiento = (i) => {
    const pos = (document.getElementById('rod_pos_'+i)?.value || '').trim();
    const mod = (document.getElementById('rod_mod_'+i)?.value || '').trim();
    if (!mod) return;
    if (!window.data[i].rodamientos) window.data[i].rodamientos = [];
    window.data[i].rodamientos.push({ pos: pos || '—', mod });
    document.getElementById('rod_pos_'+i).value = '';
    document.getElementById('rod_mod_'+i).value = '';
    window.save();
    // Actualizar lista sin re-render completo
    const lista = document.getElementById('rod_lista_'+i);
    if (lista) {
        lista.innerHTML = window.data[i].rodamientos.map((r,ri) => `
            <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #e0e0e0;">
                <span style="background:#004F88;color:white;border-radius:4px;padding:2px 8px;font-size:0.78em;font-weight:700;min-width:40px;text-align:center;">${r.pos}</span>
                <span style="flex:1;font-size:0.88em;">${r.mod}</span>
                <button onclick="window.quitarRodamiento(${i},${ri})" style="background:none;border:none;color:#e74c3c;cursor:pointer;font-size:1em;">✕</button>
            </div>`).join('');
        document.getElementById('rod_mod_'+i)?.focus();
    }
};

window.quitarRodamiento = (i, ri) => {
    if (!window.data[i].rodamientos) return;
    window.data[i].rodamientos.splice(ri, 1);
    const checks = window.data[i].rodamientos_ok || {};
    const newC = {};
    window.data[i].rodamientos.forEach((_,ni) => { if (checks[ni >= ri ? ni+1 : ni]) newC[ni] = true; });
    window.data[i].rodamientos_ok = newC;
    window.save(); window.render();
};

window.agregarTemp = (i) => {
    const t   = document.getElementById(`tmp_t_${i}`)?.value?.trim();
    const lc  = document.getElementById(`tmp_lc_${i}`)?.value?.trim();
    const ll  = document.getElementById(`tmp_ll_${i}`)?.value?.trim();
    const est = document.getElementById(`tmp_est_${i}`)?.value?.trim();
    if (!t || !lc || !ll || !est) { alert('Completa todos los campos de temperatura.'); return; }
    if (!window.data[i].temp_registros) window.data[i].temp_registros = [];
    window.data[i].temp_registros.push({ t, lc, ll, est });
    window.data[i].temp_registros.sort((a,b) => +a.t - +b.t);
    window.save();
    // Actualizar tabla sin re-render completo
    const tbody = document.querySelector(`#temp_tbody_${i}`);
    if (tbody) {
        tbody.innerHTML = window.data[i].temp_registros.map((r,ri)=>`
            <tr style="background:${ri%2===0?'#f8fbff':'white'};border-bottom:1px solid #dde1e7;">
                <td style="padding:3px 8px;text-align:center;font-weight:600;">${r.t}'</td>
                <td style="padding:3px 8px;text-align:center;color:#e74c3c;">${r.lc}°</td>
                <td style="padding:3px 8px;text-align:center;color:#3498db;">${r.ll}°</td>
                <td style="padding:3px 8px;text-align:center;color:#27ae60;">${r.est}°</td>
                <td style="padding:3px 4px;text-align:center;"><button onclick="window.quitarTemp(${i},${ri})" style="background:none;border:none;color:#e74c3c;cursor:pointer;">✕</button></td>
            </tr>`).join('');
    }
    // Sugerir próximo tiempo
    const nextT = (+t + 10);
    setTimeout(() => {
        const inp = document.getElementById(`tmp_t_${i}`);
        if (inp) inp.value = nextT;
        const lcInp = document.getElementById(`tmp_lc_${i}`);
        if (lcInp) { lcInp.value = ''; lcInp.focus(); }
        const llInp = document.getElementById(`tmp_ll_${i}`);
        if (llInp) llInp.value = '';
        const estInp = document.getElementById(`tmp_est_${i}`);
        if (estInp) estInp.value = '';
    }, 30);
    // Redibujar gráfico en tiempo real
    setTimeout(() => window.dibujarGraficoTemp(i), 80);
};
window.quitarTemp = (i, ri) => {
    if (!window.data[i].temp_registros) return;
    window.data[i].temp_registros.splice(ri, 1);
    window.save();
    const tbody = document.querySelector(`#temp_tbody_${i}`);
    if (tbody) {
        tbody.innerHTML = window.data[i].temp_registros.map((r,ri2)=>`
            <tr style="background:${ri2%2===0?'#f8fbff':'white'};border-bottom:1px solid #dde1e7;">
                <td style="padding:3px 8px;text-align:center;font-weight:600;">${r.t}'</td>
                <td style="padding:3px 8px;text-align:center;color:#e74c3c;">${r.lc}°</td>
                <td style="padding:3px 8px;text-align:center;color:#3498db;">${r.ll}°</td>
                <td style="padding:3px 8px;text-align:center;color:#27ae60;">${r.est}°</td>
                <td style="padding:3px 4px;text-align:center;"><button onclick="window.quitarTemp(${i},${ri2})" style="background:none;border:none;color:#e74c3c;cursor:pointer;">✕</button></td>
            </tr>`).join('');
    }
    setTimeout(() => window.dibujarGraficoTemp(i), 80);
};
window.agregarTerminacion = (i) => {
    const input = document.getElementById(`term_input_${i}`);
    const txt = (input?.value || '').trim();
    if (!txt) return;
    if (!window.data[i].terminaciones_lista) window.data[i].terminaciones_lista = [];
    window.data[i].terminaciones_lista.push(txt);
    input.value = '';
    window.save();
    window.render();
};

window.quitarTerminacion = (i, ti) => {
    if (!window.data[i].terminaciones_lista) return;
    window.data[i].terminaciones_lista.splice(ti, 1);
    // Reindexar los checks
    const checks = window.data[i].terminaciones_checks || {};
    const newChecks = {};
    window.data[i].terminaciones_lista.forEach((_, ni) => {
        const oldIdx = ni >= ti ? ni + 1 : ni;
        if (checks[oldIdx]) newChecks[ni] = true;
    });
    window.data[i].terminaciones_checks = newChecks;
    window.save();
    window.render();
};

window.guardarObs = (i, key) => {
    const txt = document.getElementById(`obs_${key}_${i}`);
    if (!window.data[i].observaciones) window.data[i].observaciones = {};
    window.data[i].observaciones[key] = txt ? txt.value : "";
    window.save();
};

// Función para manejar el acordeón
window.acordeonesAbiertos = new Set();
window.toggleAccordion = (event) => {
    const btn = event.currentTarget || event.target.closest('.accordion');
    const otId = String(btn.dataset.otId);
    btn.classList.toggle("active");
    const panel = btn.nextElementSibling;
    panel.classList.toggle("show");
    if (window.acordeonesAbiertos.has(otId)) {
        window.acordeonesAbiertos.delete(otId);
    } else {
        window.acordeonesAbiertos.add(otId);
    }
}

// Navegar directo a una OT en su área y abrirla
window.irAOT = (areaId, otId) => {
    const vistaMap = {
        desarme_mant: 'desarme_mant',
        calidad: 'calidad',
        mecanica: 'mecanica',
        bobinado: 'bobinado',
        armado_bal: 'armado_bal',
        despacho: 'despacho'
    };
    window.acordeonesAbiertos.clear();
    window.acordeonesAbiertos.add(String(otId));
    window.mostrarVista(vistaMap[areaId] || areaId);
    // Scroll al acordeón tras render
    setTimeout(() => {
        const btn = document.querySelector(`.accordion[data-ot-id="${otId}"]`);
        if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
};

