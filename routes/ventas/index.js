var express = require('express');
var router = express.Router();
var funciones = require('../funciones');
var {Venta, DetalleVenta, Producto, Cliente} = require('../../db/main');
const { Op } = require("sequelize");
var {attributesVenta} = require('../attributes.json');

/* VENTAS */
/* POST NUEVO VENTAS */
router.post('/', async function(req, res, next) {
  const attributesVenta = req.body;
  const {arreglos, detallesVenta, cliente} = attributesVenta;
  funciones.buscarClienteId(cliente.id)
  .then(async ()=>{
    let productosIds = [];
    detallesVenta.forEach(detalle => {
      productosIds.push(detalle.producto.id);
    }); 
    funciones.buscarProductosIds(productosIds)
    .then(async (productosLista)=>{ 
      if(productosLista.length === detallesVenta.length){
        const datosVenta = {
          "numFactura": attributesVenta.numFactura,
          "fechaVenta": attributesVenta.fechaVenta,
          "tipoPago": attributesVenta.tipoPago,
          "observacion": attributesVenta.observacion,
          "valorFinal": attributesVenta.valorFinal,
          "clienteId": cliente.id
        };
        const venta = await Venta.create(datosVenta);
        if(productosLista.length != 0){
          const detallesVentaConId = detallesVenta.map(detalle => ({
            ...detalle,
            productoId: detalle.producto.id,
            ventaId: venta.id
          }));
          await DetalleVenta.bulkCreate(detallesVentaConId);
          detallesVenta.forEach(async (detalle) => {
            await Producto.decrement({stock: detalle.cantidad}, {where: {id: detalle.producto.id}});
          });
        }
        funciones.buscarFullVentaId(venta.id)
        .then((venta)=>{ console.log({venta});
         res.json({ status:'ok', venta }); })
      }else{
        res.json({status:'error', error: "Algun Producto no encontrado"});
      }
    })
  })
  .catch((error) => {
    console.log(error);
    res.json({status:'error', error})
  })
})

/* GET BUSQUEDA VENTAS */
router.get("/buscar", function(req, res, next){
  const { limit, offset, busqueda} = req.query;
  Venta.count({
    where:{
      [Op.or]:[
        {numFactura: {[Op.iLike]: busqueda + '%'}}
      ]}
  })
  .then((total)=>{
    Venta.findAll({
      attributes: attributesVenta,
      include: [{
        model:Cliente,
        as:'cliente'
      },
      {
        model:DetalleVenta,
        as:'detalles',
        include: [{
          model:Producto,
          as:'producto'
        }]
      }],
      where:{
        [Op.or]:[
          {numFactura: {[Op.iLike]: busqueda + '%'}}
        ]},
      order: [['numFactura']],
      offset,
      limit
    })
    .then((ventas)=>{
      res.json({
        status:'ok',
        ventas,
        total
      });
    })
  })
  .catch((error) => { console.log(error); res.json({status:'error', error}) });
});

/* ACTUALIZAR UNA VENTA */
router.put('/actualizar', async function(req, res, next) {
  const {id} = req.query;
  const attributesVenta = req.body;
  const {arreglos, productos, clienteId} = attributesVenta; 
  funciones.buscarClienteId(clienteId)
  .then(async ()=>{
    funciones.buscarArreglosIds(arreglos)
    .then(async (arreglosLista)=>{
      if(arreglosLista.length === arreglos.length){  
        funciones.buscarProductosIds(productos)
        .then(async (productosLista)=>{ 
          if(productosLista.length === productos.length){
            funciones.buscarVentaId(id)
            .then(async (venta)=>{
              try {
                await venta.set({...attributesVenta,clienteId});
                if(arreglosLista.length != 0){
                  await venta.setArreglos(arreglos);
                }
                if(productosLista.length != 0){
                  await venta.setProductos(productos);
                }
                venta.save();
                funciones.buscarFullVentaId(venta.id)
                .then((venta)=>{ res.json({ status:'ok', venta }); })
                .catch((error) => { console.log(error); res.json({status:'error', error}) });
              } catch (error) {
                console.log(error); res.json({status:'error', error});
              }
            })
          }else{
            res.json({status:'error', error: "Producto no encontrado"});
          }
        })
      }else{
        res.json({status:'error', error: "Arreglo no encontrado"});
      }
    })
  })
  .catch((error) => {console.log(error);res.json({status:'error', error})});
});

module.exports = router;
