// module.exports = (function() {

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

    Link.prototype.getValue = function() {
      return this.value;
    };

    Link.prototype.valueOf = function() {
      return {
        source: this.getSource(),
        target: this.getTarget(),
        value: this.getValue()
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
        return sum + input.getValue();
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
      this.nodes = []
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
      if (indexOfNode > -1) {
        this.nodes = this.nodes.slice(0,indexOfNode).concat(this.nodes.slice(indexOfNode));
      }
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
    Group of layers
   */
  var Mesh = (function(Point, Link) {
    function Mesh(data) {
      this.layers = [];

      this.links = [];

      this.data = data;

      this.points = data.points.map(function(point, index) {
        point.index = index;
        return new Point(point);
      });

      var layers = this.layers,
          points = this.points
          links = this.links;

      /**
        Recursively iterate through the links and their children, creating a new
        layer for each depth, populating it with nodes.
      */
      var expand = function(linkArr, depth) {
        var sourceLayer = layers[depth],
            nextLevel = depth+1,
            targetLayer = layers[nextLevel];

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
            expand(linkAttrs.links, depth+1);
          }
        });
      }

      expand(data.links, 0);


      /**
        TODO: Work backwards through the layers looking for terminal points which can
        then be merged
       */
      // var coalesce = function() {
      //
      // }
    }

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

//   return Mesh;
// })();
