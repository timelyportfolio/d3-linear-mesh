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
      .attr("transform", "translate(100,100)");

  var layer = svg
    .selectAll('.layer')
      .data(mesh.layers)
      .enter()
    .append('g')
      .attr('class', 'layer')
      .attr('transform', function(d, idx) {
        var x = (idx * nodeWidth) + (nodeSpacing * idx);
        return 'translate('+x+',100)';
      });

  var node = layer
    .selectAll('.node')
      .data(function(d) {
        // condense our array here - the indexes correspond to the initial Point index in the data so aren't necessarily 0-indexed
        return d.nodes.filter(function(node) {
          return node;
        });
      })
      .enter()
    .append('g')
      .attr('class', 'node');

  node.append('rect')
    .attr({
      transform: function(node, idx) {
        var y = (idx * (nodeHeight + nodeSpacing));
        node.position = {x: 0, y: y};
        return 'translate(0, '+y+')';
      },
      width: 100,
      height: 100
    });

  node.append('text')
    .attr('transform', function(d, idx) {
      var y = (idx * (nodeHeight + nodeSpacing)) + nodePadding * 2;
      return 'translate('+nodePadding+', '+y+')';
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
