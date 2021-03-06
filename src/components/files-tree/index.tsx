import React, { useCallback, useEffect } from 'react';
import cn from 'classnames';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import MultiBackend, {
  MouseTransition,
  TouchTransition,
} from 'react-dnd-multi-backend';
import './index.scss';
import { Entity, EntityData, EntityProps, EntityType } from '../entity';
import traverse from 'traverse';
import { FILES_TREE_TYPES, useFilesTree } from '../../hooks/use-files-tree';

const HTML5toTouch = {
  backends: [
    {
      id: 'html5',
      backend: HTML5Backend,
      transition: MouseTransition,
    },
    {
      id: 'touch',
      backend: TouchBackend,
      options: { enableMouseEvents: true }, // Note that you can call your backends with options
      preview: true,
      transition: TouchTransition,
    },
  ],
};

export interface FilesTreeLeaf {
  id: string;
  type: FILES_TREE_TYPES;
  name: string;
  time: string;
  inner: FilesTreeLeaf[];
}

export interface FilesTreeProps {
  tree: FilesTreeLeaf;
  itemRenderer: (
    props: FilesTreeLeaf,
    tree: FilesTreeLeaf,
    setTree: any,
  ) => React.ReactChild;
  classes?: {
    plot?: string;
    item?: string;
  };
}

export function FilesTree({
  children,
  className,
  itemRenderer,
  classes,
  tree: initTree,
  ...props
}: React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> &
  FilesTreeProps) {
  const { tree, setTree } = useFilesTree();
  useEffect(() => {
    setTree(initTree);
  }, [initTree, setTree]);
  return (
    // @ts-ignore
    <DndProvider backend={HTML5Backend}>
      <div className={cn('files-tree', className)}>
        <FilesTreePlot
          tree={tree}
          setTree={setTree}
          type={tree.type}
          id={tree.id}
          isRoot>
          {tree.inner.map((leaf) => (
            <FilesTreePlot
              tree={tree}
              setTree={setTree}
              id={leaf.id}
              type={leaf.type}
              key={leaf.name + leaf.time}
              className={classes?.plot}>
              <FilesTreeItem
                tree={tree}
                setTree={setTree}
                className={classes?.item}
                type={leaf.type}
                id={leaf.id}>
                {itemRenderer(leaf, tree, setTree)}
              </FilesTreeItem>
            </FilesTreePlot>
          ))}
        </FilesTreePlot>
      </div>
    </DndProvider>
  );
}

export interface FilesTreePlotProps {
  type: FILES_TREE_TYPES;
  id: string;
  tree: FilesTreeLeaf;
  setTree: any;
  isRoot?: boolean;
  tag?: string;
}

function isDropValid(
  id: FilesTreeLeaf['id'],
  tree: FilesTreeLeaf,
  dragId: FilesTreeLeaf['id'],
) {
  let notAllowedIds: string[] = [];
  let fromRootToRoot = false;
  traverse(tree).forEach(function (treeItem) {
    if (treeItem?.id === dragId) {
      fromRootToRoot = !!this.parent?.parent?.isRoot && id === 'root';
      traverse(treeItem.inner).forEach((treeItem) => {
        if (treeItem.id != null) {
          notAllowedIds.push(treeItem.id);
        }
      });
    }
  });
  return (
    !notAllowedIds.find((notAllowedId) => notAllowedId === id) &&
    !fromRootToRoot
  );
}

export function FilesTreePlot({
  children,
  className,
  tag = 'div',
  type,
  id,
  tree,
  setTree,
  isRoot,
  ...props
}: React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> &
  FilesTreePlotProps) {
  const [{ isOver }, drop] = useDrop({
    accept:
      type === FILES_TREE_TYPES.folder
        ? [FILES_TREE_TYPES.folder, FILES_TREE_TYPES.file]
        : [],
    canDrop: (dragItem, monitor) => {
      return (
        (dragItem as any).id !== id &&
        isDropValid(id, tree, (dragItem as any).id)
      );
    },
    drop: (item, monitor) => (monitor.isOver() ? { id } : undefined),
    collect: (monitor) => ({
      isOver:
        monitor.isOver({ shallow: true }) &&
        monitor.getItem().id !== id &&
        isDropValid(id, tree, monitor.getItem().id),
    }),
  });
  const Tag: any = `${tag}`;
  return (
    <Tag
      ref={drop}
      className={cn('files-tree__plot', className, {
        'files-tree__plot--is-over': isOver,
        'files-tree__plot--root': isRoot,
      })}
      {...props}>
      {children}
    </Tag>
  );
}

export interface FilesTreeItemProps {
  type: FILES_TREE_TYPES;
  id: FilesTreeLeaf['id'];
  tree: FilesTreeLeaf;
  setTree: any;
}

export function FilesTreeItem({
  children,
  className,
  type,
  id,
  tree,
  setTree,
  ...props
}: React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> &
  FilesTreeItemProps) {
  const [{ opacity }, dragRef] = useDrag({
    item: { type, id },
    end: (item, monitor) => {
      const dropResult = monitor.getDropResult();
      if (dropResult == null) {
        return;
      }
      console.log(dropResult, item?.id);
      moveItem(tree, setTree, item?.id, dropResult.id);
    },
    collect: (monitor) => ({
      opacity: monitor.isDragging() ? 0.5 : 1,
    }),
  });
  return (
    <div
      ref={dragRef}
      className={cn('files-tree__item', className)}
      style={{ opacity }}
      {...props}>
      {children}
    </div>
  );
}

function moveItem(
  tree: FilesTreeLeaf,
  setTree: any,
  dragId: FilesTreeLeaf['id'] | undefined,
  dropId: FilesTreeLeaf['id'] | undefined,
) {
  if (dropId == null || dragId == null) {
    return;
  }
  const copiedTree = { ...tree };
  // need to improve big O and reduce memory consuming
  traverse(copiedTree).forEach(function (node) {
    if (node?.id === dragId) {
      const copiedDrag = traverse.clone(this.node);
      if (this.parent) {
        this.remove(true);
        traverse(copiedTree).forEach(function (node) {
          if (node?.id === dropId) {
            this.node.inner.push(copiedDrag);
          }
        });
      }
    }
  });
  setTree(copiedTree);
}

export interface FilesTreeEntityProps {
  leaf: FilesTreeLeaf;
  tree: FilesTreeLeaf;
  setTree: any;
}

export function transformLeafToEntity(leaf: FilesTreeLeaf) {
  let transformedEntityType: EntityType;
  let transformedEntityInner: EntityData[] = [];
  switch (leaf.type) {
    case FILES_TREE_TYPES.file:
      transformedEntityType = EntityType.text;
      break;
    case FILES_TREE_TYPES.folder:
      transformedEntityType = EntityType.folder;
      break;
    default:
      transformedEntityType = EntityType.text;
  }
  if (leaf.inner != null) {
    transformedEntityInner = leaf.inner.map(transformLeafToEntity);
  }
  return {
    ...leaf,
    type: transformedEntityType,
    inner: transformedEntityInner,
  };
}

export function FilesTreeEntity({
  children,
  className,
  leaf,
  tree,
  setTree,
  ...props
}: React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> &
  FilesTreeEntityProps) {
  const entityData = transformLeafToEntity(leaf);
  const renderCb = useCallback(
    (entityProps: EntityProps) => {
      const filesTreeType =
        entityProps.data.type === EntityType.folder
          ? FILES_TREE_TYPES.folder
          : FILES_TREE_TYPES.file;
      return (
        <FilesTreePlot
          tree={tree}
          setTree={setTree}
          id={entityProps.data.id}
          type={filesTreeType}
          key={entityProps.data.time + entityProps.data.name}>
          <FilesTreeItem
            type={filesTreeType}
            id={entityProps.data.id}
            tree={tree}
            setTree={setTree}>
            <Entity {...entityProps} />
          </FilesTreeItem>
        </FilesTreePlot>
      );
    },
    [setTree, tree],
  );
  return (
    <Entity
      className={cn('files-tree-entity', className)}
      {...props}
      data={entityData}
      innerComponent={renderCb}
    />
  );
}
