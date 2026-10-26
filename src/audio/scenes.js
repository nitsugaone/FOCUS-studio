      const SCENES = {
        rain: { label:'Lluvia cálida', description:'Lluvia filtrada, fondo cálido y notas suaves.', cutoff:1900, root:65.406, rate:0.023, depth:70, white:0.65, interval:12, mix:{noise:75,drone:22,notes:18} },
        ocean: { label:'Océano profundo', description:'Ruido grave que respira lentamente como el oleaje.', cutoff:420, root:49, rate:0.065, depth:180, white:0.12, interval:18, mix:{noise:82,drone:35,notes:10} },
        space: { label:'Espacio', description:'Drone abierto y campanas sobre una armonía compartida.', cutoff:650, root:55, rate:0.014, depth:100, white:0.04, interval:8, mix:{noise:30,drone:65,notes:48} },
        wind: { label:'Viento entre hojas', description:'Brisa aireada con ráfagas lentas y susurro de hojas, sin melodía por defecto. Evolución regula las ráfagas.', cutoff:380, root:49, rate:0.02, depth:30, white:0, brown:0.18, wind:0.85, melody:false, interval:24, mix:{noise:70,drone:0,notes:0} },
        fire: { label:'Fogón suave', description:'Fondo grave con crepitaciones suaves e irregulares, sin melodía por defecto.', cutoff:900, root:49, rate:0.018, depth:35, white:0.06, crackle:0.55, melody:false, interval:22, mix:{noise:68,drone:0,notes:0} },
        speech: { melody:false, label:'Cubrir conversaciones', description:'Textura continua más amplia, sin melodía por defecto. Ajustá a un volumen cómodo.', cutoff:2600, root:55, rate:0.01, depth:0, white:0.85, interval:25, mix:{noise:82,drone:0,notes:0} }
      };
export {SCENES};
