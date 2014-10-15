define(['./lib/jquery/dist/jquery'], function() {

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
    }

    Link.prototype.getSource = function() {
      return this.sourceNode;
    };

    Link.prototype.getTarget = function() {
      return this.targetNode;
    };

    Link.prototype.path = function() {
      var s = this.sourceNode.position,
          t = this.targetNode.position,
          curvature = 0.75,
          x0 = (s.x + s.width),
          y0 = (s.y + s.height/2),
          x1 = (s.x+s.width+s.gutter),
          y1 = (t.y + t.height/2),
          xi = d3.interpolateNumber(x0,x1),
          xc0 = xi(curvature),
          xc1 = xi(curvature);

      return [
        // start coords
        'M '+x0+','+y0,
        // control point 1
        'C'+xc0+','+y0,
        // control point 2
        xc1+','+y1,
        // end coords
        x1+','+y1
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
      this.nodes = [];
    }

    Layer.prototype.addNode = function(index, node) {
      if (node instanceof Node) {
        this.nodes[index] = node;
      } else {
        console.error(node, 'is not a node');
      }
    };

    Layer.prototype.getNode = function(index) {
      return this.nodes[index];
    };

    Layer.prototype.removeNode = function(node) {
      var indexOfNode = this.nodes.indexOf(node);
      delete this.nodes[indexOfNode];
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
      nodeSpacing: 50,
      nodePadding: 10,
      nodeWidth: 100,
      maxNodeHeight: 250
    };

    function Mesh(data, opts) {
      this.layers = [];
      this.links = [];
      this.data = data;
      this.opts = jQuery.extend({}, defaultOpts, opts);

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

      expandLinks(data.links, 0);
    };

    Mesh.prototype.recalculateNodeSizes = function() {
      // set node heights
      var maxCount = 0;
      this.layers.forEach(function(layer) {
        layer.nodes.forEach(function(node) {
          if (node && maxCount < node.count()) {
            maxCount = node.count();
          }
        });
      });

      // set node height range
      this.nodeHeight = d3
        .scale
        .linear()
        .domain([0, maxCount])
        .range([0, this.opts.maxNodeHeight]);
    };

    Mesh.prototype.recalculatePositions = function() {
      var _this = this;

      // First: position all layers
      this.layers.forEach(function(layer, idx) {
        layer.position = {
          x: (idx * _this.opts.nodeWidth) + (_this.opts.nodeSpacing * idx),
          y: 0
        };
      });

      // Second: position all nodes
      this.layers.forEach(function(layer, layerIdx) {
        // filter out empty indexes
        layer.nodes.filter(function(node) {
          return node;
        }).forEach(function(node, nodeIdx) {
          var height = _this.nodeHeight(node.count());
          node.position = {
            x: 0,
            y: (nodeIdx * (height + _this.opts.nodeSpacing)),
            width: _this.opts.nodeWidth,
            height: height,
            gutter: _this.opts.nodeSpacing
          };
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

  return Mesh;
});
