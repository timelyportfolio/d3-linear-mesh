require(['../lib/d3/d3', '../linear-mesh'], function(d3, Mesh) {

  var mesh = new Mesh(data);

  var width = 800,
      height = 1000,
      nodeWidth = 100,
      nodeHeight = 100,
      nodePadding = 10,
      nodeSpacing = 50;

  var svg = d3.select("body")
    .append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr({
        x: nodeSpacing,
        y: nodeSpacing
      });

  var layer = svg
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

  var node = layer
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
      width: 100,
      height: 100
    });

  node.append('text')
    .attr({
      x: function(node) { return node.position.x + nodePadding; },
      y: function(node) { return node.position.y + (nodePadding * 2);}
    })
    .text(function(node) {
      return node.point.name + ': ' + node.count();
    });

  var links = node
    .selectAll('.link')
      .data(function(node) {
        return node.outputs;
      })
      .enter()
    .append('path')
      .attr({
        'class': 'link',
        d: function(link, idx) {
          var sourceNode = link.sourceNode,
              targetNode = link.targetNode;

          return 'M '+nodeWidth+' '+(sourceNode.position.y + nodeHeight/2)+
                 ' C'+(nodeWidth+nodeSpacing/2)+' '+(sourceNode.position.y + nodeHeight/2)+
                 ' '+(nodeWidth+nodeSpacing/2)+' '+(targetNode.position.y + nodeHeight/2)+
                 ' '+(nodeWidth+nodeSpacing)+' '+(targetNode.position.y + nodeHeight/2);
        },
        fill: 'none',
        stroke: '#555',
        'stroke-width': function(d) {
          return d.getValue();
        }
      });

});
