stoicReady(1, function() {

  define('stc_dendrogram', ['mapperjs', 'helper', 'd3', 'utils', 'lodash'], function(mappers, helper, d3, utils, _) {

    "use strict";
    var perspective = {identifier: 'stc_dendrogram'};

    perspective.bind = function ($scope, $container, demoData) {
      var self = this;

      try {

        var clean = function(node) {
          node = _(node).cloneDeep();
          delete node.x0;
          delete node.x;
          delete node.y0;
          delete node.y;
          delete node.hasChildren;
          delete node.children;
          delete node._children;
          delete node.parent;
          delete node.parentLink;
          delete node.depth;
          delete node.color;
          return node;
        };

        var $content = $('<div>')
          .addClass('stc-dendrogram-perspective')
          .addClass('dendrogram')
          .appendTo($container);
        $content.height($container.outerHeight());
        $container.css({'overflow-x':'auto', 'overflow-y':'hidden'});

        // The following fields are hard-coded for that demo purposes
        var
            parentField     = 'parentId',
            iconField       = 'icon',
            positionField   = 'position',
            colorField      = 'color',
            data,
            d3content       = d3.select($content.get(0)),
            space           = 189,
            canClick        = true,
            centerNode,
            centerNodeName,
            left            = 100,
            ratio           = 1,
            duration        = 500,
            okToDrag        = false,

            nodes,

            _w              = $content.outerWidth(),
            _h              = $content.outerHeight()-20,

            dragging        = null,
            elementSelected,
            nodeSelected

            ;

        var oldH = _h,
            newH;

        var blankNode = {};
        var nodeCentral;

        //========================================== DATABASE LISTENER

        self.onRecordUpdate = function(record) {
          // Disabled on that demo
        };

        self.onRecordCreate = function(record) {
          // Disabled on that demo
        };

        self.onRecordRemove = function(id) {
          // Disabled on that demo
        };

        //========================================== LAYOUT DEFINITION

        var tree = d3.layout.tree()
          .size([_h, _w])
          .sort(function(a, b) {
            return d3.ascending(getPosition(a), getPosition(b));
          })
          ;

        var diagonal = d3.svg.diagonal()
            .projection(function(d) { return [d.y, d.x]; });


        //========================================== SVG CONSTRUCTION

        var vis = d3content.append("svg:svg")
            .attr("width", '100%')
            .attr("height", '100%')
            .append("svg:g")
              .attr("transform", "translate(" + left + "," + 10 + ")");

        var g = $content.children('svg').children('g:first-child');

        //========================================== COLORS FROM CSS

        var fullColor = utils.getColor('.COLORS.blue');
        var emptyColor = utils.getColor('.COLORS.white');

        //========================================== UTILITY FUNCTIONS

        var getName = function(d) {
          var name = d.name;
          return (name)? name : '';
        };

        // Trim a name by ending it with '…'
        var compact = function(name) {
          var size = 16;
          if(name.length <= size) {
            return name;
          } else {
            return name.substring(0, size)+'…';
          }
        };

        var setName = function(d, name) {
          d.name = name;
          update(d);
        };

        var getColor = function(d) {
          if(colorField) {
            if(!d[colorField]) {
              setColor(d, fullColor);
            }
            return utils.getColor(d[colorField]);
          } else {
            return fullColor;
          }
        };

        var setColor = function(d, color) {
          d[colorField] = color;
        };

        var getPosition = function(d) {
          if (!d[positionField]) {
            d[positionField] = utils.hash(getName(d));
          }
          return d[positionField];
        };

        var setPosition = function(d, pos, persist) {
          if(pos !== getPosition(d)) {
            d[positionField] = pos;
          }
        };

        var getMidPosition = function(up,down) {
          if(!up) {return getPosition(down)/2;}
          else if(!down) {return getPosition(up)*2;}
          else {return (getPosition(up)+getPosition(down))/2;}
        };

        var getParentId = function(d) {
          if(d.parent) {return getId(d.parent);}
          else {return (d[parentField])? d[parentField] : '';}
        };

        var getId = function(d) {
          return (d && d.id)? d.id : null;
        };

        var moveSvg = function(callback) {
            var oldWidth = $content.width();
            var newWidth = left+ (maxX+1)*space;
            if(newWidth >= _w) {
              $content.stop();
              $content.animate({'width':newWidth}, duration);
              if(newWidth>oldWidth) {$container.animate({'scrollLeft':newWidth}, duration);}
            } else if(newWidth < _w) {
              $content.animate({'width':_w}, duration);
            }

            var newPos = (newWidth > _w/2 && maxX>1) ? minX*space+left : left;

            var d3g = d3.select(g[0]);
            var trans = getTranslationXY(d3g);
            if(newPos !== trans.x) {
              d3g
                .transition()
                .duration(duration)
                .attr('transform', 'translate('+newPos+','+trans.y+')')
                .each('end', callback)
                ;
            } else if(callback) {
              callback();
            }
        };

        var getTranslationXY = function(d) {
          var parts  = /translate\(\s*([^\s,)]+)[ ,]([^\s,)]+)/.exec(d.attr('transform'));
          return {'x':parseInt(parts[1],10), 'y':parseInt(parts[2],10)};
        };

        var removeNode = function(d, callback) {
          if(d.parent && d.parent.children) {
            var p = d.parent,
                c = p.children,
                l = p.children.length;

            for(var i=0; i<l; i++) {
              if(getId(c[i]) === getId(d)) {
                c.splice(i,1);
                break;
              }
            }
            update(d, callback);
          }
        };

        var addNode = function(d, newParent) {
          d.parent = newParent;
          d[parentField] = clean(newParent).id || null;
          d.depth = newParent.depth+1;
          if(!newParent.hasChildren) {
            newParent.hasChildren = true;
            newParent.children = [d];
            update(newParent);
          } else if(!newParent.children && !newParent._children) {
            computeChildren(newParent, function() {
              onCircleClick(newParent);
            });
          } else if(!newParent.children && newParent._children) {
            newParent._children.push(d);
            onCircleClick(newParent);
            canClick = true;
          } else if(newParent.children) {
            newParent.children.push(d);
            update(newParent);
          }
        };


        var computeRoot = function(d, callback) {
          var k = 0, nb = 0, id = ((d)? getId(d) : null);

          var children = _(demoData).filter(function(node) {return node[parentField] === id;}).value();

          var l = children.length;

          centerNodeName = root.name;

          if(d) {
            centerNodeName = getName(d);
            centerNode = d;
          }

          var temp = $('<span>').text(compact(centerNodeName)).appendTo($content);
          left = 25+temp.width();
          temp.remove();

          // case1: One unique ancestor
          if(id === null && l === 1) {
            var child = children[0];
            root.id = child.id;
            computeRoot(child, callback);
          // case2: Multiple ancestors
          } else if(l > 0) {
            children.forEach(function(child) {
              // Set the hasChildren attribute to the new children
              computeHasChildren(child, function() {
                child.parent = root;
                root.children.push(child);

                if(++nb === l) {
                  callback();
                }
              });
            });
          } else {
            callback();
          }

        };

        // fetch and assign the children to a node (and hide them)
        var computeChildren = function(d, callback) {

          try {
            // Only compute children if it has not been before
            if(d.hasChildren && !d.children && !d._children) {

              var id = getId(d) || null;

              var nb = 0;

              var children = _(demoData).filter(function(node) {return node[parentField] === id;}).value();

              var l = children.length;
              children.forEach(function(child) {
                // Set the hasChildren attribute to the new children
                computeHasChildren(child, function() {
                  if(++nb === l) {
                    d._children = children;
                    callback();
                  }
                });
              });

            } else {callback();}
          } catch(err) {
            self.error(err);
          }
        };

        // Simplified function for demo purposes
        var computeHasChildren = function(d, callback) {
          var hasChildren = _(demoData).filter(function(node) {return node[parentField] === d.id;}).value().length > 0;
          d.hasChildren = hasChildren;
          callback(hasChildren);
        };

        var toggleAll = function(d) {
          if (d.children || d.children) {
            d.children.forEach(toggleAll);
            toggle(d);
          }
        };

        var toggle = function(d) {
          if (d.children) {
            d._children = d.children;
            d.children = null;
          } else {
            d.children = d._children;
            d._children = null;
          }
          console.log(d);
        };

        var getIcon = function(d) {
          if(iconField && d[iconField]) {
            return d[iconField];
          }
        };

        var setIcon = function(d, icon) {
          d[iconField] = icon;
        };

        var createIcon = function(d, element) {
          var toLeft = !d.toLeft ^ d.hasChildren;
          var foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject' );
          $(element).children('foreignObject').remove();
          var $fo = $(foreignObject);
          var $body = $(document.createElement( 'body' )); // you cannot create bodies with .apend("<body />") for some reason
          $fo.attr("x", (toLeft)?'0.5em':'-1.7em').attr("y", '-0.85em').attr("width", '2em').attr("height", '2em').append($body);
          $body.css({'background-color':'transparent', 'color':getColor(d), 'overflow':'hidden', 'padding':0});
          $body.append('<i class="'+getIcon(d)+'"></i>');
          $fo.appendTo(element);
          return $fo;
        };

        var onCircleClick = function(d, callback) {
          try {
            if(canClick) {
              canClick = false;
              toggle(d);
              update(d, function() {
                canClick = true;
                if(callback) {callback();}
              });
            }
          } catch(e) {self.error(e);}
        };

        var maxX = 0, minX = 0;
        var update = function(source, callback) {
          try {

            // Compute the new tree layout.
            nodes = tree.nodes(root);

            console.log('New nodes:', nodes);

            root.x = _h/2;

            var nb = 0,
                d,
                len = nodes.length;

            maxX = 0;

            for(var i=0; i<len; i++) {
              d = nodes[i];
              computeHasChildren(d, function() {
                d.y = d.depth * space;
                d.x = d.x * ratio;
                // d.dy = null;
                // d.dx = null;
                if(d.depth > maxX) {
                  maxX = d.depth;
                }
                if (++nb === len) {
                  moveSvg();
                  nodesComputed(root, source, nodes, callback);}
              });
            }

          } catch(e) {self.error(e);}
        };

        var nextUp, nextDown, nextPlace, currentColumn = 0;
        var dragAndDrop = function(d, x, y) {
          var newNextUp, newNextDown, column, diff, oldDiffD, oldDiffU;
          column = Math.ceil( (x - space/2) / space );
          if(column !== 0) {
            if(currentColumn !== column) {
              currentColumn = column;
              newNextUp = null;
              newNextDown = null;
            }
            oldDiffD = 10000;
            oldDiffU = -10000;
            nodes.forEach(function(node) {
              if(Math.abs(currentColumn) === node.depth && !node.isBlank) {
                diff = node.x-y;
                if(diff > 0 && diff < oldDiffD) {
                  newNextDown = node;
                  oldDiffD = diff;
                } else if(diff < 0 && diff > oldDiffU) {
                  newNextUp = node;
                  oldDiffU = diff;
                }
              }
            });
            if((getId(newNextUp) !== getId(nextUp) || getId(newNextDown) !== getId(nextDown)) && (newNextUp || newNextDown)) {
              // A new valid position !
              nextUp =  newNextUp;
              nextDown = newNextDown;
              nextPlace = nextUp || nextDown;
              removeNode(blankNode);
              blankNode = {'isBlank':true, parent:nextPlace.parent, depth:nextPlace.depth, id:'___blank', x:0, y:0, x0:0, y0:0};
              setPosition(blankNode, getMidPosition(nextUp, nextDown));
              addNode(blankNode, nextPlace.parent);
            }
          }
        };

        var dx=0, dy=0, initPos, timerDrag, elementDragged;
        var nodesComputed = function(root, source, nodes, onEndCallback, onClickCallback) {
          try {

            var end = false;

            // Update the nodes
            var node = vis.selectAll("g.node.right")
                .data(nodes.slice(1), function(d) { return getId(d); });

            var nodeEnter = node.enter().append("svg:g")
                .attr("class", "node right")
                .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
                .attr("opacity", function(d) {return (d.isBlank)?0:1;})
                .on("click", function(d, i, onClickCallback) {
                  if(canClick) {
                    if(elementSelected) {elementSelected.classed("highlighted", false);}
                    elementSelected = d3.select(this);
                    elementSelected.classed("highlighted", true);
                    nodeSelected = d;

                    var id = getId(d);
                    if(d.hasChildren) {
                      if(!d.children) {
                        computeChildren(d, function() {
                          onCircleClick(d, onClickCallback);
                        });
                      } else {
                        onCircleClick(d, onClickCallback);
                      }
                    }
                  }
                })
                .call(d3.behavior.drag()
                  .on("drag", function(d) {
                    if(!elementDragged) {elementDragged = d3.select(this);}
                    if(!dragging) {
                      dx=0, dy=0, dragging = d, initPos = getTranslationXY(elementDragged);
                      // Edit the classes so it is not fetched by tree.nodes()
                      elementDragged.attr('class', 'node');
                      $(this).css('pointer-events', 'none');
                      d3.select(d.parentLink).attr('opacity', 0);
                      removeNode(d);
                    }
                    dx += d3.event.dx;
                    dy += d3.event.dy;
                    if(dragging) {
                      dragAndDrop(d, initPos.x+dx, initPos.y+dy);
                      elementDragged.attr('transform', 'translate('+(initPos.x+dx)+','+(initPos.y+dy)+')');
                    }
                  })
                  .on("dragend", function(d) {
                    if(dragging) {
                      $(this).css('pointer-events', 'auto');
                      elementDragged.attr('class', "node right");
                      d3.select(this).attr('opacity', 1).transition().duration(duration/2).attr('opacity', 0);
                      dragging = null;
                      elementDragged = null;
                      if(nextPlace) {
                        setPosition(d, getMidPosition(nextUp, nextDown), true);
                        addNode(d, nextPlace.parent);
                      } else {
                        addNode(d, d.parent);
                      }
                      removeNode(blankNode);
                    }
                  })
                )
                .each(function(d) {
                  if(getIcon(d)) {createIcon(d ,this);}
                });

            nodeEnter.append("svg:circle")
                .attr("r", 1e-6)
                .style("stroke", function(d) { getColor(d);})
                .style("fill", function(d) { return (!d.children && d.hasChildren) ? getColor(d) : emptyColor; });

            nodeEnter.append("svg:title")
                .text(getName);

            nodeEnter.append("svg:text")
                .attr("x", function(d) { var s = (getIcon(d))? 25 : 10; return d.hasChildren ? -s : s; })
                .attr("dy", ".35em")
                //.style("fill", function(d) {var c = getColor(d); if(c === fullColor) {c = '';} return c;})
                .attr("text-anchor", function(d) {
                  return (d.hasChildren ? "end" : "start") ;
                })
                //.attr('class', function(d) { return getIcon(d); })
                .text(function(d) { return compact(getName(d)); })
                .style("fill-opacity", 1e-6);

            // Transition nodes to their new position.
            var nodeUpdate = node.transition()
                .duration(duration)
                .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })
                .each(function(d) {
                  if(getIcon(d)) {createIcon(d ,this);}
                })
                .each("end", function() {if(!end) {end = true; if(typeof onEndCallback === 'function') {onEndCallback(source);}}})
                ;

            nodeUpdate.select("circle")
                .attr("r", 4.5)
                .style("stroke", function(d) { return getColor(d); })
                .style("fill", function(d) { return (!d.children && d.hasChildren) ? getColor(d) : emptyColor; });

            nodeUpdate.select("text")
                .text(function(d) { return compact(getName(d)); })
                .style("fill-opacity", 1);

            // Transition exiting nodes to the parent's new position.
            var nodeExit = node.exit().transition()
                .duration(duration)
                .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
                .each("end", function() {if(!end) {end = true; if(typeof onEndCallback === 'function') {onEndCallback(source);}}})
                .remove();

            nodeExit.select("circle")
                .attr("r", 1e-6);

            nodeExit.select("text")
                .style("fill-opacity", 1e-6);

            // Update the links…
            var link = vis.selectAll("path.link.right")
                  .data(tree.links(nodes), function(d) { return getId(d.target); });

            // Enter any new links at the parent's previous position.
            link.enter()
                .insert("svg:path", "g")
                .attr("class", "link right")
                .attr("d", function(d) {
                  var o = {'x': source.x0, 'y': source.y0};
                  return diagonal({source: o, target: o});
                })
                .attr('opacity', function(d) {return (d.target.isBlank)?0:1;})
                .each(function(d) {d.target.parentLink = this;})
                .transition()
                .duration(duration)
                .attr("d", diagonal)
                ;

            // Transition links to their new position.
            link
                .transition()
                .duration(duration)
                .attr("d", diagonal)
                .attr('opacity', function(d) {return (d.target.isBlank)?0:1;})
                ;

            // Transition exiting nodes to the parent's new position.
            link.exit()
                .transition()
                .duration(duration)
                .attr("d", function(d) {
                  var o = {'x': source.x, 'y': source.y};
                  return diagonal({source: o, target: o});
                })
                .remove();

            // Stash the old positions for transition.
            nodes.forEach(function(d) {
              d.x0 = d.x;
              d.y0 = d.y;
            });

          } catch(e) {self.error(e);}
        };


        //================================== INITIALIZATION

        var onNodeCentralClicked = function() {
          canClick = true;
          if(!isNodeCentralClicked) {
            minX = 0;
            maxX = 0;
          }
          isNodeCentralClicked = !isNodeCentralClicked;
        };

        var isNodeCentralClicked = false;

        nodeCentral = vis.append("svg:g")
            .attr('id', 'nodeCentral')
            .attr("class", "node root")
            .attr("transform", function() { return "translate(" + 0 + "," + (_h/2) + ")"; })
            .on("click", function(d) {
              if(canClick) {
                if(elementSelected) {elementSelected.classed("highlighted", false);}
                elementSelected = d3.select(this);
                elementSelected.classed("highlighted", true);
                nodeSelected = null;

                canClick = false;
                circleCentral
                  .transition()
                  .duration(500)
                  .style("fill", function(d) { return !isNodeCentralClicked ? fullColor : emptyColor; });

                toggle(root);
                update(root, function() { onNodeCentralClicked(); });
              }
            });

        $content.find('#nodeCentral').hide();

        var circleCentral = nodeCentral.append("svg:circle")
            .attr("r", 4.5)
            .style("stroke", fullColor)
            .style("fill", emptyColor);

        var onRootsComputed = function() {
          nodeCentral.append("svg:title")
            .text(centerNodeName);

          nodeCentral.append("svg:text")
            .attr("x", function() { return (getIcon(root))? -25 : -10;})
            .attr("dy", ".35em")
            .attr("text-anchor", "end")
            .text(compact(centerNodeName))
            .attr('opacity', 1e-6)
            .transition()
              .duration(duration/2)
              .attr('opacity', 1)
            ;
        };

        //=========================================================== PERSPECTIVE CREATION ENTRY POINT

        var rootId   = _(demoData).find({parentId: null}).id;
        var rootName = _(demoData).find({parentId: null}).name;

        var root = {id: rootId, name: rootName, children:[], hasChildren:true, x0:_h/2, y0:0};
        computeRoot(root, function() {
          console.log(root);
          $content.find('#nodeCentral').show();
          update(root, onRootsComputed);
        });

      } catch(err) {perspective.error(err);}
    };

    perspective.unbind = function(callback) {
      // Unbind all custom listeners and clean if needed
      callback();
    };

    return perspective;

  });

});
