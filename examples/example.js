require(['../lib/d3/d3', '../linear-mesh'], function (d3, Mesh) {
  var width = 800,
    height = 1000,
    nodeWidth = 100,
    maxNodeHeight = 300,
    nodePadding = 10,
    nodeSpacing = 50,
    mesh,
    svg,
    node,
    links;

  mesh = new Mesh(window.data, {
    nodeWidth: nodeWidth,
    maxNodeHeight: maxNodeHeight,
    nodePadding: nodePadding,
    nodeSpacing: nodeSpacing
  });

  svg = d3.select("body")
    .append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr({
        x: nodeSpacing,
        y: nodeSpacing
      });

  layer = svg
    .selectAll('.layer')
      .data(mesh.layers)
      .enter()
    .append('g')
      .attr({
        'class': 'layer',
        transform: function(layer, idx) {
          return 'translate('+layer.position.x+','+layer.position.y+')';
        }
      });

  node = layer
    .selectAll('.node')
      .data(function(layer) {
        // compact our array here - the indexes correspond to the initial Point index in the data so aren't necessarily 0-indexed
        return layer.nodes.filter(function(node) {
          return node;
        });
      })
      .enter()
    .append('g')
      .attr('class', 'node');

  node.append('rect')
    .attr({
      x: function(node) { return node.position.x; },
      y: function(node) { return node.position.y; },
      width: function(node) { return node.position.width; },
      height:  function(node) { return mesh.nodeHeight(node.count()); },
    });

  node.append('text')
    .attr({
      x: function(node) { return node.position.x + nodePadding; },
      y: function(node) { return node.position.y + (nodePadding * 2);}
    })
    .text(function(node) {
      return node.point.name + ': ' + node.count();
    });

  links = node
    .selectAll('.link')
      .data(function(node) {
        return node.outputs;
      })
      .enter()
    .append('path')
      .attr({
        'class': 'link',
        d: function(link) { return link.path(); },
        fill: 'none',
        stroke: '#555',
        'stroke-width': function(link) { return link.weight; }
      });
});
