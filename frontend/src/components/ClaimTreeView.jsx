/** Renders the FULL branching rebuttal tree from a flat node list (see
 * backend GET /clips/:id/tree) as an indented, collapsible outline — the
 * lineage was previously only visible one level at a time, by clicking
 * into each reply individually. Deliberately a simple indent tree, not an
 * SVG/canvas diagram: legible at any depth, no new rendering dependency,
 * consistent with the rest of the app's plain HTML/CSS visual language. */
function buildChildMap(nodes) {
  const byParent = {};
  for (const n of nodes) {
    const key = n.parent_clip_id || "__root__";
    (byParent[key] = byParent[key] || []).push(n);
  }
  return byParent;
}

function TreeNode({ node, byParent, currentClipId, onNavigate, depth }) {
  const children = byParent[node.clip_id] || [];
  const isCurrent = node.clip_id === currentClipId;
  return (
    <div>
      <button
        onClick={() => onNavigate(node.clip_id)}
        className={`block text-left text-xs py-1.5 px-2 rounded-md w-full truncate transition-colors ${
          isCurrent ? "bg-[var(--accent-soft)] text-[var(--accent)] font-medium" : "hover:bg-[var(--bg-muted)] text-[var(--fg-muted)]"
        }`}
        data-testid={`tree-node-${node.clip_id}`}
      >
        {node.deleted ? "[deleted]" : `"${node.caption}"`}
        <span className="text-[var(--fg-subtle)]"> · {node.uploader_name}{node.likes > 0 ? ` · ${node.likes}♥` : ""}</span>
      </button>
      {children.length > 0 && (
        <div className="border-l border-[var(--border)] ml-3 pl-3 mt-0.5 space-y-0.5">
          {children.map((c) => (
            <TreeNode key={c.clip_id} node={c} byParent={byParent} currentClipId={currentClipId} onNavigate={onNavigate} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClaimTreeView({ nodes, rootClipId, currentClipId, onNavigate }) {
  if (!nodes || nodes.length === 0) return null;
  const byParent = buildChildMap(nodes);
  const root = nodes.find((n) => n.clip_id === rootClipId);
  if (!root) return null;
  return (
    <div className="space-y-0.5" data-testid="claim-tree-view">
      <TreeNode node={root} byParent={byParent} currentClipId={currentClipId} onNavigate={onNavigate} depth={0} />
    </div>
  );
}
