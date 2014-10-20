/*global: d3*/
require(['linear-mesh'], function (linearMesh) {

  var Mesh = linearMesh.default;

  var width = document.body.clientWidth,
    height = 1000,
    minNodeWidth = 110,
    maxNodeWidth = 200,
    minNodeHeight = 70,
    maxNodeHeight = 250,
    nodePadding = 10,
    nodeSpacingX = 100,
    nodeSpacingY = 50,
    nodeHeaderHeight = 25,
    mesh,
    svg,
    node,
    linkContainer,
    link;

  mesh = new Mesh(window.data, {
    maxNodeHeight: maxNodeHeight,
    minNodeHeight: minNodeHeight,
    maxNodeWidth: maxNodeHeight,
    minNodeWidth: minNodeHeight,
    nodePadding: nodePadding,
    nodeSpacingX: nodeSpacingX,
    nodeSpacingY: nodeSpacingY,
    containerWidth: width
  });

  svg = d3.select("body")
    .append("svg")
      .attr("width", width)
      .attr("height", height)
    .append("g")
      .attr({
        x: nodeSpacingX,
        y: nodeSpacingY
      });


  // filters go in defs element
  var defs = svg.append("defs");

  // create filter with id #drop-shadow
  // height=130% so that the shadow is not clipped
  var filter = defs.append("filter")
    .attr({
      id: 'drop-shadow',
      height: '130%',
      width: '130%'
    });

  filter.append("feGaussianBlur")
    .attr({
      'in': 'SourceAlpha',
      stdDeviation: 2,
      result: 'blur'
    });

  filter.append("feOffset")
    .attr({
      'in': 'blur',
      dx: 3,
      dy: 3,
      result: 'offsetBlur'
    });

  filter.append('feComponentTransfer')
    .append('feFuncA')
      .attr({
        type: 'linear',
        slope: 0.3
      });

  var feMerge = filter.append("feMerge");

  feMerge.append("feMergeNode");
  feMerge.append("feMergeNode")
      .attr("in", "SourceGraphic");


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

  linkContainer = node
    .selectAll('.link')
      .data(function(node) {
        return node.outputs;
      })
      .enter()
    .append('g').attr('class', 'link-container');

  link = linkContainer.append('path')
    .attr({
      'class': 'link',
      d: function(link) { return link.path(); },
      fill: '#555'
    });

  var tipContainer = svg.append('g')
    .attr('class','tip');

  var rect = tipContainer.append('rect');
  rect.style('filter', 'url(#drop-shadow)');


  var tipText;
  function resizeTip() {
    var textHeight = tipText.reduce(function(sum, line, index) {
      var bbox = line.node().getBBox(),
        height = bbox.height;
      line.attr('y', nodePadding + (height*(index+1)));
      return sum + height;
    }, (nodePadding*2));

    var textWidth = tipText.reduce(function(max, line, index) {
      var bbox = line.node().getBBox(),
        width = bbox.width;
      line.attr('x', nodePadding);
      return Math.max(width+(nodePadding*2), max);
    }, nodePadding*2);

    tipContainer.select('rect').attr({
      height: textHeight,
      width: textWidth
    });
  }

  function displayTip(lines) {
    tipText = [];
    tipContainer.style('opacity', 1);
    tipContainer.select('.description').remove();
    tipDescriptionNode = tipContainer.append('g')
      .attr('class', 'description');

    lines.forEach(function(line) {
      addLine(line[0], line[1]);
    });

    resizeTip();
  }

  function repositionTip() {
    var position = d3.mouse(svg.node());
    tipContainer.attr('transform', 'translate('+(position[0]+10)+','+(position[1]+10)+')');
  }

  function hideTip() {
    tipContainer.style('opacity', 0);
  }

  var tipDescriptionNode;
  function addLine(text, classes) {
    var line = tipDescriptionNode.append('text')
                .attr('class','highlight poi-name')
                .html(text)
    tipText.push(line);
  }


  linkContainer.on('mouseenter', function(link) {
    displayTip([
      [link.sourceNode.point.name, 'highlight poi-name text-uppercase'],
      ['to', 'text-uppercase'],
      [link.targetNode.point.name, 'highlight poi-name text-uppercase']
    ]);
  });

  linkContainer.on('mousemove', repositionTip);

  linkContainer.on('mouseleave', function() {
    tipContainer.style('opacity', 0);
  });

  // node background
  var nodeBlock = node.append('rect')
    .attr({
      'class': 'nodeBg',
      x: function(node) { return node.position.x; },
      y: function(node) { return node.position.y; },
      width: function(node) { return node.position.width; },
      height: function(node) { return node.position.height; },
    });

  // header background
  node.append('rect')
    .attr({
      'class': 'nodeHeader',
      x: function(node) { return node.position.x; },
      y: function(node) { return node.position.y - nodeHeaderHeight; },
      width: function(node) { return node.position.width; },
      height: nodeHeaderHeight
    });


  // header text
  node.append('text')
    .attr({
      x: function(node) { return node.position.x + nodePadding; },
      y: function(node) { return node.position.y - nodeHeaderHeight/4;}
    })
    .text(function(node) {
      return node.point.name;
    });

  // visitor count text
  node.append('text')
    .attr({
      'class': 'nodeCount',
      x: function(node) { return node.position.x + nodePadding; },
      y: function(node) { return node.position.y + (nodePadding * 5);}
    })
    .text(function(node) {
      return node.count();
    });

  nodeBlock.on('mouseenter', function(node) {

    var lines = [[node.point.name, 'highlight poi-name text-uppercase']];

    node.outputs.forEach(function(link) {
      lines.push(['to', 'text-uppercase']);
      lines.push([link.targetNode.point.name, 'highlight poi-name text-uppercase']);
    });

    displayTip(lines);
  });

  nodeBlock.on('mousemove', repositionTip);
  nodeBlock.on('mouseleave', hideTip);
});
