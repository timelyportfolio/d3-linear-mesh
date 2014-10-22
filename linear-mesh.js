/*global: d3*/
define('linear-mesh', ['exports'], function(exports) {

  /**
    Represents a POI.

    Should be unique in ID and name, but can be referenced by many Nodes
   */
  var Point = (function() {
    function Point(attrs) {
      this.name = attrs.name;
      this.index = attrs.index;
    }

    return Point;
  })();

  /**
    A link between two nodes
   */
  var Link = (function() {
    function Link(sourceNode, targetNode, value) {
      this.sourceNode = sourceNode;
      this.targetNode = targetNode;
      this.value = value;

      this.position = {
        y0: 0,
        y1: 0
      };
    }

    Link.prototype.getSource = function() {
      return this.sourceNode;
    };

    Link.prototype.getTarget = function() {
      return this.targetNode;
    };

    Link.prototype.calculatePosition = function() {
      var s = this.sourceNode.position;

      this.position.x0 = (s.x + s.width),
      this.position.x1 = (s.x+s.width+s.gutter);
    };

    Link.prototype.path = function() {
      var p = this.position,
        curvature = 0.35,
        xi, xc0, xc1;

      this.calculatePosition();

      xi = d3.interpolateNumber(p.x0, p.x1);
      xc0 = xi(curvature);
      xc1 = xi(1-curvature);

      return [
        // top left
        'M '+p.x0+','+p.y0,
        // curving to the right-hand node
        // control point 1
        'C'+xc0+','+p.y0,
        // control point 2
        xc1+','+p.y1,
        // top right
        p.x1+','+p.y1,
        // bottom right
        'L '+p.x1+','+p.y2,
        // curving back to the left-hand node
        // control point 1
        'C'+xc1+','+p.y2,
        // control point 2
        xc0+','+p.y3,
        // bottom left
        p.x0+','+p.y3,
        // close the path
        'Z'
      ].join(' ');
    };

    Link.prototype.valueOf = function() {
      return {
        source: this.getSource(),
        target: this.getTarget(),
        value: this.value
      }
    };

    return Link;
  })();

  /**
    A wrapper around a Point, linking it with inputs and outputs.
   */
  var Node = (function() {
    var refCounter = 0;
    function Node(point) {
      this.point = point;
      this._ref = ++refCounter;
      this.inputs = [];
      this.outputs = [];
    }

    Node.prototype.addInput = function(link) {
      this.inputs.push(link);
    };

    Node.prototype.addOutput = function(link) {
      this.outputs.push(link);
    };

    /**
      If this node has inputs, then these are summed to give us the total count.

      If there are no inputs, i.e. this is at the start of a chain, then the
      outputs are summed to give us the count.
     */
    Node.prototype.count = function() {
      var links = this.inputs.length ? this.inputs : this.outputs;

      return links.reduce(function(sum, input) {
        return sum + input.value;
      }, 0);
    };

    /**
      Set link positions using #count and link#value for context
     */
    Node.prototype.repositionLinks = function() {
      var _this = this,
        pos = this.position,
        offset = 0;

      // inputs, set y1
      this.inputs.forEach(function(link) {
        var cover = (link.value / _this.count()) * pos.height,
            y1 = pos.y,
            y2 = pos.y + cover;
        link.position.y1 = offset + y1;
        link.position.y2 = offset + y2;
        offset += cover;
      });

      // outputs, set y0
      offset = 0;
      this.outputs.forEach(function(link) {
        var cover = (link.value / _this.count()) * pos.height,
            y0 = pos.y,
            y3 = pos.y + cover;
        link.position.y0 = offset + y0;
        link.position.y3 = offset + y3;
        offset += cover;
      });
    };

    Node.prototype.valueOf = function() {
      return {
        name: this.point.name,
        value: this.count(),
        inputs: this.inputs.map(function(link) {
          return link.valueOf();
        }),
        outputs: this.outputs.map(function(link) {
          return link.valueOf();
        })
      };
    };

    return Node;
  })();

  /**
    Groups a set of nodes, handles depth management
   */
  var Layer = (function(Node) {
    function Layer(depth) {
      this.depth = depth;
      this.indexedNodes = [];
      this.nodes = []
    }

    Layer.prototype.addNode = function(index, node) {
      if (node instanceof Node) {
        this.indexedNodes[index] = node;
        this.nodes.push(node);
      } else {
        console.error(node, 'is not a node');
      }
    };

    Layer.prototype.getNode = function(index) {
      return this.indexedNodes[index];
    };

    Layer.prototype.removeNode = function(node) {
      // remove from the indexed list
      var indexOfNode = this.indexedNodes.indexOf(node);
      delete this.indexedNodes[indexOfNode];

      // then remove from the unindexed list
      indexOfNode = this.nodes.indexOf(node);
      this.nodes = this.nodes
        .slice(0,indexOfNode)
        .concat(this.nodes.slice(indexOfNode+1));

      return node;
    };

    Layer.prototype.valueOf = function() {
      return this.nodes.map(function(node) {
        return node.valueOf();
      });
    };

    return Layer;
  })(Node);

  /**
    Layout manager
   */
  var Mesh = (function(Point, Link) {

    var defaultOpts = {
      minNodeSpacingX: 50,
      nodeSpacingY: 50,
      nodePadding: 10,
      minNodeWidth: 110,
      maxNodeWidth: 200,
      maxNodeHeight: 250,
      minNodeHeight: 20,
      containerWidth: 1000
    };

    function Mesh(data, opts) {
      this.layers = [];
      this.links = [];
      this.data = data;

      this.opts = function(defaults, overrides) {
        var opts = {};
        for (key in defaults) { opts[key] = defaults[key]; }
        for (key in overrides) { opts[key] = overrides[key]; }
        return opts;
      }(defaultOpts, opts)

      this.points = data.points.map(function(point, index) {
        point.index = index;
        return new Point(point);
      });

      this.expand();
      this.recalculateNodeSizes();
      this.recalculatePositions();
    }

    Mesh.prototype.expand = function() {
      var layers = this.layers,
          points = this.points
          links = this.links;
      /**
        Recursively iterate through the links and their children, creating a new
        layer for each depth, populating it with nodes.
      */
      var expandLinks = function(linkArr, depth) {
        var sourceLayer = layers[depth],
            nextLevel = depth+1,
            targetLayer = layers[nextLevel]

        // if we haven't yet worked at this depth, create a new layer
        if (sourceLayer == void 0) {
          sourceLayer = layers[depth] = new Layer(depth);
        }

        // if we haven't yet worked at one level deeper, create a new layer
        if (targetLayer == void 0) {
          targetLayer = layers[nextLevel] = new Layer(nextLevel);
        }

        // Assign source nodes into layers
        linkArr.forEach(function(linkAttrs) {
          var sourceNode = sourceLayer.getNode(linkAttrs.source),
              targetNode = targetLayer.getNode(linkAttrs.target),
              link;

          // if we haven't yet referenced the source point at this depth, create a new reference
          if (sourceNode == void 0) {
            sourceNode = new Node(points[linkAttrs.source]);
            sourceLayer.addNode(linkAttrs.source, sourceNode);
          }

          // if we haven't yet referenced the target point at the subsequent depth, create a new reference
          if (targetNode == void 0) {
            targetNode = new Node(points[linkAttrs.target]);
            targetLayer.addNode(linkAttrs.target, targetNode);
          }

          // create the link
          link = new Link(sourceNode, targetNode, linkAttrs.value);
          links.push(link);

          // assign the link to the inputs of the source node
          sourceNode.addOutput(link);

          // assign the link to the inputs of the target node
          targetNode.addInput(link);

          // process children
          if (linkAttrs.links) {
            expandLinks(linkAttrs.links, depth+1);
          }
        });
      }

      expandLinks(this.data.links, 0);
    };

    Mesh.prototype.recalculateNodeSizes = function() {
      // get maximum node visit count
      var maxCount = 0;
      this.layers.forEach(function(layer) {
        layer.nodes.forEach(function(node) {
          if (node && maxCount < node.count()) {
            maxCount = node.count();
          }
        });
      });

      // set node height range
      this.nodeHeight = d3.scale
        .linear()
        .domain([0, maxCount])
        .range([0, this.opts.maxNodeHeight]);


      // set node widths
      var layerCount = this.layers.length;
      var nodeWidth = (this.opts.containerWidth / ((layerCount * 2) -1));
      nodeWidth = Math.min(this.opts.maxNodeWidth, Math.max(this.opts.minNodeWidth, nodeWidth));

      // set node spacing
      var nodeSpacingX = nodeWidth;
      while (this.opts.containerWidth <= ((nodeWidth * layerCount) + (nodeSpacingX * (layerCount - 1))) &&
            nodeSpacingX > this.opts.minNodeSpacingX) {

        nodeSpacingX = Math.max(this.opts.minNodeSpacingX, nodeSpacingX -= 10);
      }

      this.opts.nodeSpacingX = nodeSpacingX;
      this.opts.nodeWidth = nodeWidth;
    };

    Mesh.prototype.recalculatePositions = function() {
      var _this = this;

      // First: position all layers
      this.layers.forEach(function(layer, idx) {
        layer.position = {
          x: (idx * _this.opts.nodeWidth) + (_this.opts.nodeSpacingX * idx),
          y: 0
        };
      });

      // Second: position all nodes
      this.layers.forEach(function(layer, layerIdx) {
        // filter out empty indexes
        var nodes = layer.nodes.filter(function(node) {
          return node;
        });

        var offset = _this.opts.nodeSpacingY;

        nodes.forEach(function(node, nodeIdx) {
          var height = _this.nodeHeight(node.count()),
              previousNode = nodes[nodeIdx-1];

          offset += (previousNode ? previousNode.position.height + _this.opts.nodeSpacingY : 0);

          node.position = {
            x: 0,
            y: offset,
            width: _this.opts.nodeWidth,
            height: Math.max(_this.opts.minNodeHeight, height),
            gutter: _this.opts.nodeSpacingX
          };
          node.repositionLinks();
        });
      });
    };

    /**
      Returns a POJO representation of the mesh
    */
    Mesh.prototype.valueOf = function() {
      return {
        layers: this.layers.map(function(layer) {
          return layer.valueOf();
        })
      };
    };

    return Mesh;
  })(Point, Link);

  exports.default = Mesh;
});
