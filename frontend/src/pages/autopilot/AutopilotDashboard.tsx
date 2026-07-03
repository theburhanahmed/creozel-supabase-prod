import React from 'react'
import { Link } from 'react-router-dom'
import { WorkflowIcon, CalendarIcon, SparklesIcon, ExternalLinkIcon, PlusIcon } from 'lucide-react'

export const AutopilotDashboard: React.FC = () => {
  const n8nUrl = (import.meta.env.VITE_N8N_URL as string | undefined) ?? 'http://localhost:5678'

  return (
    <div className="space-y-6">
      <div className="glass-enhanced rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Autopilot</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Automate your content workflows with n8n pipelines
        </p>
      </div>

      {/* n8n integration card */}
      <div className="glass-enhanced rounded-2xl p-6 border border-purple-200/50 dark:border-purple-800/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white flex-shrink-0">
            <WorkflowIcon size={22} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-gray-900 dark:text-white mb-1">n8n Workflow Automation</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Creozel uses n8n for pipeline automation. Create workflows that generate content,
              schedule posts, and publish across platforms — all on autopilot.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={n8nUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-500 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
                <ExternalLinkIcon size={16} />
                Open n8n Editor
              </a>
              <Link to="/autopilot/builder"
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3FE0A5] to-[#38B897] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
                <PlusIcon size={16} />
                Create Pipeline
              </Link>
              <Link to="/workflow"
                className="flex items-center gap-2 px-4 py-2 glass-light text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:glass transition-colors">
                <WorkflowIcon size={16} />
                View Executions
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Generate Content',  icon: <SparklesIcon size={20} />,  href: '/content',   color: 'from-[#3FE0A5] to-[#38B897]',   desc: 'Create AI-powered content' },
          { label: 'Schedule Posts',    icon: <CalendarIcon size={20} />,  href: '/calendar',  color: 'from-blue-500 to-indigo-500',    desc: 'Plan your content calendar' },
          { label: 'View Pipelines',    icon: <WorkflowIcon size={20} />,  href: '/workflow',  color: 'from-purple-500 to-violet-500',  desc: 'Monitor automation runs' },
        ].map((item) => (
          <Link key={item.href} to={item.href}
            className="glass-enhanced rounded-2xl p-5 hover:scale-[1.02] transition-transform">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white mb-3`}>
              {item.icon}
            </div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{item.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</p>
          </Link>
        ))}
      </div>

      {/* Getting started */}
      <div className="glass-enhanced rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
          Getting Started with Autopilot
        </h2>
        <ol className="space-y-3">
          {[
            'Connect your social accounts in Social Accounts settings',
            'Open the n8n editor and import a workflow template',
            'Configure your content generation steps with your Supabase Edge Function URL',
            'Set a cron schedule and activate the workflow',
            'Monitor executions in the Workflow Dashboard',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#3FE0A5]/20 text-[#3FE0A5] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-sm text-gray-600 dark:text-gray-400">{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
