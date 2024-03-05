import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import * as $rdf from 'rdflib';
import { createDiskAndLink } from '@/components/graph';
import * as rdfHelpers from '@/components/rdfHelpers';

const Diagram = ({ selectedClass, store, setTableData }) => {
    const svgRef = useRef(null);
    const mainClassRef = useRef(null); 

    useEffect(() => {
        const svg = d3.select(svgRef.current)
            .attr('width', '100%')
            .attr('height', '100%');

        const group = svg.append('g').attr('class', 'disk-and-label');

        group.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', 'lightgray');
        

        const zoom = d3.zoom()
            .scaleExtent([0.4, 3])
            .on('zoom', (event) => {
                group.attr('transform', event.transform);
            });

        svg.call(zoom);

        return () => {
            svg.selectAll('*').remove();
            svg.remove();
        };
    }, []);

    useEffect(() => {
        if (selectedClass) {
            const startX = 100;
            const startY = 100;
            const circleRadius = 50;
            const svg = d3.select(svgRef.current);
            const group = svg.select('g');

            const disk = group.append('circle')
                .attr('class', 'class-circle')
                .attr('nodeId',selectedClass)
                .attr('classId', selectedClass)
                .attr('cx', startX)
                .attr('cy', startY)
                .attr('r', circleRadius)
                .style('fill', 'white')
                .style('stroke', 'black')
                .style('stroke-width', 2)
                .call(d3.drag().on('drag', dragged))
                .on('contextmenu', (event) => displayContextMenu(event, selectedClass));

            mainClassRef.current = disk.node();

            const label = rdfHelpers.getLabelFromURI(store, selectedClass);
            group.append('text')
                .attr('class', 'node-label')
                .attr('nodeId',selectedClass)
                .attr('classId', selectedClass)
                .attr('x', startX)
                .attr('y', startY)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .style('fill', 'black')
                .call(d3.drag().on('drag', dragged))
                .text(label);
            

            function dragged(event) {
                const newX = event.x;
                const newY = event.y;

                disk.attr('cx', newX)
                    .attr('cy', newY);

                d3.selectAll('text[classId="' + selectedClass + '"]')
                    .attr('x', newX)
                    .attr('y', newY);

                updateMainClassRelatedLines(newX, newY,selectedClass);
            }
        }
    }, [selectedClass]);

    function updateMainClassRelatedLines(newX, newY, nodeId) {
        d3.selectAll('.link-text').each(function() {
          const text = d3.select(this);
          const textNodeId = text.attr('nodeId');
          const textStartId = text.attr('startId');
        
          d3.selectAll('.link').each(function() {
              const line = d3.select(this);
              const startId = line.attr('startId');
              const endId = line.attr('nodeId');
    
              if (startId === nodeId || endId === nodeId) {
                  const linkPath = line.attr('d');
                  const [, targetX, targetY] = linkPath.match(/L([^,]+),([^Z]+)/);
                  const updatedLinkPath = `M${newX},${newY} L${targetX},${targetY}`;
                  line.attr('d', updatedLinkPath);
    
                  if (endId === textNodeId && startId === textStartId) {
                      const midX = (parseInt(newX) + parseInt(targetX)) / 2;
                      const midY = (parseInt(newY) + parseInt(targetY)) / 2;
                      line.attr('d', updatedLinkPath);
                      text.attr('x', midX).attr('y', midY);
                  }
              }
          });
      });
    }
    
    
    

    function displayContextMenu(event, classId) {
        event.preventDefault();
        const x = event.clientX;
        const y = event.clientY;

        const contextMenu = document.createElement("div");
        contextMenu.id = "context-menu";
        contextMenu.style.position = "absolute";
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.style.backgroundColor = "white";
        contextMenu.style.border = "1px solid #ccc";
        contextMenu.style.padding = "5px";

        const menuItems = [
            { action: 'expandSubclasses', content: 'Expand/Hide Subclasses' },
            { action: 'expandRelations', content: 'Expand/Hide Relations' },
            { action: 'removeClass', content: 'Remove Class' }
        ];

        menuItems.forEach(item => {
            const menuItem = document.createElement("div");
            menuItem.textContent = item.content;
            menuItem.style.cursor = "pointer";
            menuItem.addEventListener("click", () => handleMenuItemClick(item.action, classId));
            contextMenu.appendChild(menuItem);
        });

        document.body.appendChild(contextMenu);

        document.addEventListener("click", closeContextMenu);

        function closeContextMenu(event) {
            if (!contextMenu.contains(event.target)) {
                contextMenu.remove();
                document.removeEventListener("click", closeContextMenu);
            }
        }
    }

    function handleMenuItemClick(action, classId) {
        try {
            console.log("Menu item clicked:", action);
            if (action === 'expandSubclasses') {
                if (store) {
                    // 检查是否已经存在关系
                    const SubExists = checkSubExists(classId);
                    console.log(SubExists);
                    if (SubExists) {
                        if(checkSubHide(classId)){
                            const hiddenNodes = hideRelations(classId);
                            ExpandHavingSubs(hiddenNodes)
                        }
                        else{
                        console.log("sub already exists, hiding...");
                        hideSubs(classId);}
                    }
                    else {
                        console.log("Expanding subs...");
                        expandSubclasses(classId); 
                        console.log("subs expanded successfully.");
                    }
                } else {
                    console.error('RDF store is not available.');
                }
            } else if (action === 'expandRelations') {
                if (store) {
                    // 检查是否已经存在关系
                    const relationExists = checkRelationExists(classId);
                    console.log(relationExists);
                    if (relationExists) {
                        if(checkRelationHide(classId)){
                            ExpandHavingRelations(classId)
                        }
                        else{
                        console.log("Relation already exists, hiding...");
                        hideRelations(classId);}
                    }
                    else {
                        console.log("Expanding relations...");
                        expandRelations(classId); 
                        console.log("Relations expanded successfully.");
                    }
                } else {
                    console.error('RDF store is not available.');
                }
            } else if (action === 'removeClass') {
                removeSelectedClass(classId);
            }
        } catch (error) {
            console.error('Error handling menu item click:', error);
        }
    }
    const svg = d3.select(svgRef.current);
    function checkSubExists(classId, svg, store) {
        const clickedNode = $rdf.namedNode(classId);
        const outgoingConnectedClasses = rdfHelpers.getOutgoingConnectedClasses(store, clickedNode);
        let subExists = false;
      
        outgoingConnectedClasses.forEach(({ target }) => {
            const nodeId = target.value;
            const textlink = svg.selectAll(`.link-text[nodeId="${nodeId}"][startId="${classId}"]`);
            if (!textlink.empty()) {
                subExists = true;
                return; // Terminate the loop
            }
        });
        return subExists;
      }
    
    
    function checkSubHide(classId) {
        const clickedNode = $rdf.namedNode(classId);
        const outgoingConnectedClasses = rdfHelpers.getOutgoingConnectedClasses(store, clickedNode);
        let subHide = false;
    
        outgoingConnectedClasses.forEach(({ target }) => {
            const nodeId = target.value;
            const textlink = svg.selectAll(`.link-text[nodeId="${nodeId}"][startId="${classId}"]`);
    
            textlink.each(function() {
                const text = d3.select(this);
                if (text.style('display') === 'none') {
                    subHide = true;
                    return false; // 终止循环
                }
            });
        });
    
        return subHide;
    }
    function ExpandHavingSubs(classId) {
        const expandedNodes = {}; // 用于存储已经展开的节点ID
        expandRelatedSubs(classId);
        
        function expandRelatedSubs(nodeId) {
            // 获取与当前节点相关的连接线信息
            const connectedClasses = rdfHelpers.getOutgoingConnectedClasses(store, $rdf.namedNode(nodeId));
            
            connectedClasses.forEach(({ target }) => {
                const connectedNodeId = target.value; 
                // 如果该节点已经展开，则跳过
                if (expandedNodes[connectedNodeId]) {
                    return;
                }
                // 展开连接线
                svg.selectAll(`.link[nodeId="${connectedNodeId}"]`).style('display', 'block');
                // 展开连接线上的文字
                svg.selectAll(`.link-text[nodeId="${connectedNodeId}"]`).style('display', 'block');
                // 展开圆圈
                svg.selectAll(`circle[nodeId="${connectedNodeId}"]`).style('display', 'block');
                svg.selectAll(`text[nodeId="${connectedNodeId}"]`).style('display', 'block');
                // 将当前节点标记为已展开
                expandedNodes[connectedNodeId] = true;
                // 获取与当前节点相关的子节点并递归展开它们
                expandRelatedSubs(connectedNodeId);
                expandRelatedElements(connectedNodeId);
            });
        }
        
        function expandRelatedElements(nodeId) {
            // 获取与当前节点相关的连接线信息
            const connectedClasses = rdfHelpers.getIncomingConnectedClasses(store, $rdf.namedNode(nodeId));
            
            connectedClasses.forEach(({ target }) => {
                const connectedNodeId = target.value; // 修改变量名为 connectedNodeId
                // 如果该节点已经展开，则跳过
                if (expandedNodes[connectedNodeId]) {
                    return;
                }
                // 展开连接线
                svg.selectAll(`.link[nodeId="${connectedNodeId}"]`).style('display', 'block');
                // 展开连接线上的文字
                svg.selectAll(`.link-text[nodeId="${connectedNodeId}"]`).style('display', 'block');
                // 展开圆圈
                svg.selectAll(`circle[nodeId="${connectedNodeId}"]`).style('display', 'block');
                svg.selectAll(`text[nodeId="${connectedNodeId}"]`).style('display', 'block');
                // 将当前节点标记为已展开
                expandedNodes[connectedNodeId] = true;
                // 获取与当前节点相关的子节点并递归展开它们
                expandRelatedElements(connectedNodeId);
            });
        }
    }
    
    
    function hideSubs(classId) {
      const hiddenNodes = {}; // 用于存储已经隐藏的节点ID
      hideRelatedSubs(classId);
      function hideRelatedSubs(nodeId) {
          // 获取与当前节点相关的连接线信息
          const connectedClasses = rdfHelpers.getOutgoingConnectedClasses(store, $rdf.namedNode(nodeId));
          
          connectedClasses.forEach(({ target }) => {
            if (!target) {
                return;
            }
              const connectedNodeId = target.value;
              
              // 如果该节点已经被隐藏，则跳过
              if (hiddenNodes[connectedNodeId]) {
                  return;
              }
              // 隐藏连接线
              
              svg.selectAll(`.link[nodeId="${connectedNodeId}"]`).style('display', 'none');
              // 隐藏连接线上的文字
              svg.selectAll(`.link-text[nodeId="${connectedNodeId}"]`).style('display', 'none');
              // 隐藏圆圈
              if (connectedNodeId != selectedClass){
              svg.selectAll(`circle[nodeId="${connectedNodeId}"]`).style('display', 'none');
              svg.selectAll(`text[nodeId="${connectedNodeId}"]`).style('display', 'none');
      
              // 将当前节点标记为已隐藏
              hiddenNodes[connectedNodeId] = true;
      
              // 获取与当前节点相关的子节点并递归隐藏它们
              hideRelatedSubs(connectedNodeId);
              hideRelatedElements(connectedNodeId);
          }
        });
      }
    
      function hideRelatedElements(nodeId) {
          // 获取与当前节点相关的连接线信息
          console.log("hide relations")
          const connectedClasses = rdfHelpers.getIncomingConnectedClasses(store, $rdf.namedNode(nodeId));
          
          connectedClasses.forEach(({ target }) => {
            if (!target) {
                return;
            }

              const connectedNodeId = target.value;
              
              // 如果该节点已经被隐藏，则跳过
              if (hiddenNodes[connectedNodeId]) {
                  return;
              }
              // 隐藏连接线
              
              svg.selectAll(`.link[nodeId="${connectedNodeId}"]`).style('display', 'none');
              // 隐藏连接线上的文字
              svg.selectAll(`.link-text[nodeId="${connectedNodeId}"]`).style('display', 'none');
              // 隐藏圆圈
             if (connectedNodeId != selectedClass){
              svg.selectAll(`circle[nodeId="${connectedNodeId}"]`).style('display', 'none');
              svg.selectAll(`text[nodeId="${connectedNodeId}"]`).style('display', 'none');
      
              // 将当前节点标记为已隐藏
              hiddenNodes[connectedNodeId] = true;
      
              // 获取与当前节点相关的子节点并递归隐藏它们
              hideRelatedElements(connectedNodeId);
          }
        });
      }
    }
    
    function checkRelationExists(classId) {
        const incomingConnectedClasses = rdfHelpers.getIncomingConnectedClasses(store, $rdf.namedNode(classId));
        let relationExists = false;
    
        incomingConnectedClasses.forEach(({ target }) => {
            const nodeId = target.value;
            const textlink = svg.selectAll(`.link-text[nodeId="${nodeId}"][startId="${classId}"]`);
            if (!textlink.empty()) {
                relationExists = true;
                return; // Terminate the loop
            }
        });
    
        return relationExists;
    }
    function checkRelationHide(classId) {
        const incomingConnectedClasses = rdfHelpers.getIncomingConnectedClasses(store, $rdf.namedNode(classId));
        let relationHide = false;
    
        incomingConnectedClasses.forEach(({ target }) => {
            const nodeId = target.value;
            const textlink = svg.selectAll(`.link-text[nodeId="${nodeId}"][startId="${classId}"]`);
            textlink.each(function() {
                const text = d3.select(this);
                if (text.style('display') === 'none') {
                    relationHide = true;
                    return false; // 终止循环
                }
            });
        });
    
        return relationHide;
    }
    
    function hideRelations(classId) {
        const hiddenNodes = {}; // 用于存储已经隐藏的节点ID
    
        hideRelatedElements(classId);
    
        function hideRelatedElements(nodeId) {
            // 获取与当前节点相关的连接线信息
            const connectedClasses = rdfHelpers.getIncomingConnectedClasses(store, $rdf.namedNode(nodeId));
            console.log(connectedClasses);
    
            connectedClasses.forEach(({ target }) => {
                if (!target) {
                    return;
                }
    
                const connectedNodeId = target.value;
                console.log(connectedNodeId);
    
                // 如果该节点已经被隐藏，则跳过
                if (hiddenNodes[connectedNodeId]) {
                    return;
                }
    
                // 隐藏连接线
                svg.selectAll(`.link[nodeId="${connectedNodeId}"]`).style('display', 'none');
                // 隐藏连接线上的文字
                svg.selectAll(`.link-text[nodeId="${connectedNodeId}"]`).style('display', 'none');
                // 隐藏圆圈
                if (connectedNodeId !== selectedClass) {
                    svg.selectAll(`circle[nodeId="${connectedNodeId}"]`).style('display', 'none');
                    svg.selectAll(`text[nodeId="${connectedNodeId}"]`).style('display', 'none');
    
                    // 将当前节点标记为已隐藏
                    hiddenNodes[connectedNodeId] = true;
    
                    // 获取与当前节点相关的子节点并递归隐藏它们
                    hideRelatedElements(connectedNodeId);
                    hideRelatedSubs(connectedNodeId);
                }
            });
        }
    
        function hideRelatedSubs(nodeId) {
            // 获取与当前节点相关的连接线信息
            const connectedClasses = rdfHelpers.getOutgoingConnectedClasses(store, $rdf.namedNode(nodeId));
            connectedClasses.forEach(({ target }) => {
                if (!target) {
                    return;
                }
    
                const connectedNodeId = target.value;
                console.log(connectedNodeId);
    
                // 如果该节点已经被隐藏，则跳过
                if (hiddenNodes[connectedNodeId]) {
                    return;
                }
    
                // 隐藏连接线
                svg.selectAll(`.link[nodeId="${connectedNodeId}"]`).style('display', 'none');
                // 隐藏连接线上的文字
                svg.selectAll(`.link-text[nodeId="${connectedNodeId}"]`).style('display', 'none');
                // 隐藏圆圈 
                if (connectedNodeId !== selectedClass) {
                    svg.selectAll(`circle[nodeId="${connectedNodeId}"]`).style('display', 'none');
                    svg.selectAll(`text[nodeId="${connectedNodeId}"]`).style('display', 'none');
                    // 将当前节点标记为已隐藏
                    hiddenNodes[connectedNodeId] = true;
                    // 获取与当前节点相关的子节点并递归隐藏它们
                    hideRelatedElements(connectedNodeId);
                }
            });
        }
    }
    
    function ExpandHavingRelations(classId) {
      const expandedNodes = {}; // 用于存储已经展开的节点ID
      expandRelatedElements(classId);
      function expandRelatedElements(nodeId) {
          // 获取与当前节点相关的连接线信息
          const connectedClasses = rdfHelpers.getIncomingConnectedClasses(store, $rdf.namedNode(nodeId));
          connectedClasses.forEach(({ target }) => {
              const connectedNodeId = target.value;
              // 如果该节点已经展开，则跳过
              if (expandedNodes[connectedNodeId]) {
                  return;
              }
              // 展开连接线
              svg.selectAll(`.link[nodeId="${connectedNodeId}"]`).style('display', 'block');
              // 展开连接线上的文字
              svg.selectAll(`.link-text[nodeId="${connectedNodeId}"]`).style('display', 'block');
              // 展开圆圈
              svg.selectAll(`circle[nodeId="${connectedNodeId}"]`).style('display', 'block');
              svg.selectAll(`text[nodeId="${connectedNodeId}"]`).style('display', 'block');
                  // 将当前节点标记为已展开
              expandedNodes[connectedNodeId] = true;
              // 获取与当前节点相关的子节点并递归展开它们
              expandRelatedElements(connectedNodeId);
              expandRelatedSubs(connectedNodeId);
          });
      }
      function expandRelatedSubs(nodeId) {
        // 获取与当前节点相关的连接线信息
        const connectedClasses = rdfHelpers.getOutgoingConnectedClasses(store, $rdf.namedNode(nodeId));
        connectedClasses.forEach(({ target }) => {
            const connectedNodeId = target.value;
            // 如果该节点已经展开，则跳过
            if (expandedNodes[connectedNodeId]) {
                return;
            }
            // 展开连接线
            svg.selectAll(`.link[nodeId="${connectedNodeId}"]`).style('display', 'block');
            // 展开连接线上的文字
            svg.selectAll(`.link-text[nodeId="${connectedNodeId}"]`).style('display', 'block');
            // 展开圆圈
            svg.selectAll(`circle[nodeId="${connectedNodeId}"]`).style('display', 'block');
            svg.selectAll(`text[nodeId="${connectedNodeId}"]`).style('display', 'block');
                // 将当前节点标记为已展开
            expandedNodes[connectedNodeId] = true;
            // 获取与当前节点相关的子节点并递归展开它们
            expandRelatedElements(connectedNodeId);
        });
    }
    }
    
    

    function expandRelations(classId) {
        try {
            console.log("Expanding relation for:", classId);
            if (!classId || !store) {
                console.error('No class selected or RDF store is not available.');
                return;
            }
    
            const seenValues = new Set();
            seenValues.add(selectedClass)
    
            const clickedNode = $rdf.namedNode(classId);
            console.log(clickedNode);
            const incomingConnectedClasses = rdfHelpers.getIncomingConnectedClasses(store, clickedNode);
            console.log(incomingConnectedClasses);
            let count=0;
    
            incomingConnectedClasses.forEach(({ target, propertyUri }) => {
                const selectedCircle = d3.select(`circle[classId="${classId}"]`);
                console.log(selectedCircle);
                const cxValue = +selectedCircle.attr('cx');
                const cyValue = +selectedCircle.attr('cy');
                console.log(cxValue, cyValue);
    
                if (!seenValues.has(target.value)) {
                    seenValues.add(target.value);
                    createDiskAndLink(
                        d3.select(svgRef.current).select('g'),
                        target,
                        propertyUri,
                        'incoming',
                        target.value,
                        { x: cxValue, y: cyValue },
                        store,
                        mainClassRef,
                        classId,
                        count
                    );
                    count=count+1;
                } else {
                    console.log(`Skipping duplicate target value: ${target.value}`);
                }
            });
        } catch (error) {
            console.error('Error expanding relations:', error);
        }
    }
    
    function expandSubclasses(classId) {
        try {
            console.log("Expanding subclasses for:", classId);
            if (!classId || !store) {
                console.error('No class selected or RDF store is not available.');
                return;
            }
            
            const clickedNode = $rdf.namedNode(classId);
            console.log(clickedNode);
            const outgoingConnectedClasses = rdfHelpers.getOutgoingConnectedClasses(store, clickedNode);
            console.log(outgoingConnectedClasses);
            
            const expandedValues = new Set();
            expandedValues.add(selectedClass);
            let count=0;
    
            outgoingConnectedClasses.forEach(({ target, propertyUri }) => {
                const targetValue = target.value;
                if (expandedValues.has(targetValue)) {
                    console.log(`Subclass with target value ${targetValue} has already been expanded.`);
                    return;
                }
    
                const selectedCircle = d3.select(`circle[classId="${classId}"]`);
                const cxValue = +selectedCircle.attr('cx');
                const cyValue = +selectedCircle.attr('cy');
                expandedValues.add(targetValue);
                createDiskAndLink(
                    d3.select(svgRef.current).select('g'),
                    target,
                    propertyUri,
                    'outgoing',
                    targetValue,
                    { x: cxValue, y: cyValue },
                    store,
                    mainClassRef,
                    classId,
                    count

                );
                count=count+1;
            });
        } catch (error) {
            console.error('Error expanding subclasses:', error);
        }
    }
    

    function removeSelectedClass(classId) {
        const svg = d3.select(svgRef.current);
        const selectedCircle = svg.select('circle[classId="' + classId + '"]');
        selectedCircle.remove(); 
        const selectedText = svg.select('text[classId="' + classId + '"]');
        selectedText.remove(); 
    }

    return (
        <svg ref={svgRef}></svg>
    );
};

export default Diagram;
